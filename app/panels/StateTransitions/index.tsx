// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { uniq } from "lodash";
import * as React from "react";
import { useMemo } from "react";
import stringHash from "string-hash";
import styled, { css } from "styled-components";
import tinycolor from "tinycolor2";

import helpContent from "./index.help.md";
import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Button from "@foxglove-studio/app/components/Button";
import Dimensions from "@foxglove-studio/app/components/Dimensions";
import MessagePathInput from "@foxglove-studio/app/components/MessagePathSyntax/MessagePathInput";
import useMessagesByPath from "@foxglove-studio/app/components/MessagePathSyntax/useMessagesByPath";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TimeBasedChart, {
  getTooltipItemForMessageHistoryItem,
  TimeBasedChartTooltipData,
  DataPoint,
} from "@foxglove-studio/app/components/TimeBasedChart";
import { getGlobalHooks } from "@foxglove-studio/app/loadWebviz";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";
import { PanelConfig } from "@foxglove-studio/app/types/panels";
import { positiveModulo } from "@foxglove-studio/app/util";
import { darkColor, lineColors } from "@foxglove-studio/app/util/plotColors";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";
import { TimestampMethod, subtractTimes, toSec } from "@foxglove-studio/app/util/time";
import { grey } from "@foxglove-studio/app/util/toolsColorScheme";

export const transitionableRosTypes = [
  "bool",
  "int8",
  "uint8",
  "int16",
  "uint16",
  "int32",
  "uint32",
  "int64",
  "uint64",
  "string",
  "json",
];

const fontFamily = "'Inter UI', -apple-system, sans-serif";
const fontSize = 10;
const fontWeight = "bold";

const SRoot = styled.div`
  display: flex;
  flex-grow: 1;
  z-index: 0; // create new stacking context
  overflow: hidden;
`;

const SAddButton = styled.div<{ show: boolean }>`
  position: absolute;
  top: 30px;
  right: 5px;
  opacity: ${(props) => (props.show ? 1 : 0)};
  transition: opacity 0.1s ease-in-out;
  z-index: 1;
`;

const SChartContainerOuter = styled.div`
  width: 100%;
  flex-grow: 1;
  overflow-x: hidden;
  overflow-y: auto;
`;

const SChartContainerInner = styled.div`
  position: relative;
  margin-top: 10px;
`;

const inputColor = tinycolor(colors.DARK3).setAlpha(0.7).toHexString();
const inputColorBright = tinycolor(colors.DARK3).lighten(8).toHexString();
const inputLeft = 20;
const SInputContainer = styled.div<{ shrink: boolean }>`
  display: flex;
  position: absolute;
  padding-left: ${inputLeft}px;
  margin-top: -2px;
  height: 20px;
  padding-right: 4px;
  max-width: calc(100% - ${inputLeft}px);
  min-width: min(100%, 150px); // Don't let it get too small.
  overflow: hidden;
  line-height: 20px;

  &:hover {
    background: ${inputColor};
  }

  // Move over the first input on hover for the toolbar.
  ${(props) =>
    props.shrink &&
    css`
      max-width: calc(100% - 150px);
    `}
`;

const SInputDelete = styled.div`
  display: none;
  position: absolute;
  left: ${inputLeft}px;
  transform: translateX(-100%);
  user-select: none;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
  background: ${inputColor};
  cursor: pointer;

  &:hover {
    background: ${inputColorBright};
  }

  ${SInputContainer}:hover & {
    display: block;
  }
`;

const yAxes = [
  {
    ticks: {
      fontFamily: mixins.monospaceFont,
      fontSize: 10,
      fontColor: "#eee",
      maxRotation: 0,
    },
    type: "category",
    offset: true,
  },
];

const plugins: Chart.ChartPluginsOptions = {
  datalabels: {
    anchor: "center",
    align: -45,
    offset: 6,
    clip: true,
    font: {
      family: fontFamily,
      size: fontSize,
      weight: fontWeight,
    },
  },
  multicolorLineYOffset: 6,
};

const scaleOptions = {
  // Hide all y-axis ticks since each bar on the y-axis is just a separate path.
  yAxisTicks: "hide",
};

export type StateTransitionPath = { value: string; timestampMethod: TimestampMethod };
export type StateTransitionConfig = { paths: StateTransitionPath[] };

export function openSiblingStateTransitionsPanel(
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void,
  topicName: string,
) {
  openSiblingPanel("StateTransitions", (config: PanelConfig) => {
    return {
      ...config,
      paths: uniq(
        config.paths.concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }]),
      ),
    };
  });
}

type Props = {
  config: StateTransitionConfig;
  saveConfig: (arg0: Partial<StateTransitionConfig>) => void;
  isHovered: boolean;
};

const StateTransitions = React.memo(function StateTransitions(props: Props) {
  const { config, saveConfig, isHovered } = props;

  const onInputChange = (value: string, index?: number) => {
    if (index == null) {
      throw new Error("index not set");
    }
    const newPaths = config.paths.slice();
    newPaths[index] = { ...newPaths[index], value: value.trim() };
    saveConfig({ paths: newPaths });
  };

  const onInputTimestampMethodChange = (value: TimestampMethod, index: number | undefined) => {
    if (index == null) {
      throw new Error("index not set");
    }
    const newPaths = config.paths.slice();
    newPaths[index] = { ...newPaths[index], timestampMethod: value };
    saveConfig({ paths: newPaths });
  };

  const { paths } = config;
  const { startTime = { sec: 0, nsec: 0 } } = PanelAPI.useDataSourceInfo();
  const itemsByPath = useMessagesByPath(useMemo(() => paths.map(({ value }) => value), [paths]));

  const onlyTopicsHeight = paths.length * 55;
  const heightPerTopic = onlyTopicsHeight / paths.length;
  const xAxisHeight = 30;
  const height = Math.max(80, onlyTopicsHeight + xAxisHeight);

  const tooltips: TimeBasedChartTooltipData[] = [];
  const data = {
    yLabels: paths.map((_path, pathIndex) => pathIndex.toString()),
    datasets: paths.map(({ value: path, timestampMethod }, pathIndex) => {
      const dataItem = {
        borderWidth: 10,
        colors: [undefined], // First should be undefined to make sure we don't color in the bar before the change.
        data: [],
        fill: false,
        label: pathIndex.toString(),
        key: pathIndex.toString(),
        pointBackgroundColor: [] as string[],
        pointBorderColor: "transparent",
        pointHoverRadius: 3,
        pointRadius: 1.25,
        pointStyle: "circle",
        showLine: true,
        datalabels: {
          display: [],
        },
      };
      const baseColors = (getGlobalHooks() as any).perPanelHooks().StateTransitions
        .customStateTransitionColors[path] || [grey, ...lineColors];
      let previousValue, previousTimestamp;
      for (let index = 0; index < itemsByPath[path].length; index++) {
        const item = getTooltipItemForMessageHistoryItem(itemsByPath[path][index]);
        if (item.queriedData.length !== 1) {
          continue;
        }

        const timestamp = timestampMethod === "headerStamp" ? item.headerStamp : item.receiveTime;
        if (!timestamp) {
          continue;
        }

        const { constantName, value } = item.queriedData[0];

        // Skip duplicates.
        if (
          previousTimestamp &&
          toSec(subtractTimes(previousTimestamp, timestamp)) === 0 &&
          previousValue === value
        ) {
          continue;
        }
        previousTimestamp = timestamp;

        // Skip anything that cannot be cast to a number or is a string.
        if (Number.isNaN(value) && typeof value !== "string") {
          continue;
        }

        if (typeof value !== "number" && typeof value !== "boolean" && typeof value !== "string") {
          continue;
        }

        const valueForColor =
          typeof value === "string" ? stringHash(value) : Math.round(Number(value));
        const color = baseColors[positiveModulo(valueForColor, Object.values(baseColors).length)];
        // We add all points, colors, tooltips, etc to the *beginning* of the list, not the end. When
        // datalabels overlap we usually care about the later ones (further right). By putting those points
        // first in the list, we prioritize datalabels there when the library does its autoclipping.
        dataItem.pointBackgroundColor.unshift(darkColor(color));
        dataItem.colors.unshift(color);
        const label = constantName ? `${constantName} (${String(value)})` : String(value);
        const x = toSec(subtractTimes(timestamp, startTime));
        const y = pathIndex;
        const tooltip: TimeBasedChartTooltipData = {
          x,
          y,
          item,
          path,
          value,
          constantName,
          startTime,
        };
        tooltips.unshift(tooltip);
        const dataPoint: DataPoint = { x, y };
        const showDatalabel = previousValue === undefined || previousValue !== value;
        // Use "auto" here so that the datalabels library can clip datalabels if they overlap.
        (dataItem.datalabels.display as any).unshift(showDatalabel ? "auto" : false);
        if (showDatalabel) {
          dataPoint.label = label;
          dataPoint.labelColor = color;
        }
        (dataItem.data as any).unshift(dataPoint);
        previousValue = value;
      }
      return dataItem;
    }),
  };

  const marginRight = 20;

  return (
    <SRoot>
      <PanelToolbar floating helpContent={helpContent} />
      <SAddButton show={isHovered}>
        <Button
          onClick={() =>
            saveConfig({
              paths: [...config.paths, { value: "", timestampMethod: "receiveTime" }],
            })
          }
        >
          add
        </Button>
      </SAddButton>
      <SChartContainerOuter>
        <Dimensions>
          {({ width }) => (
            <SChartContainerInner style={{ width: width - marginRight, height }}>
              <TimeBasedChart
                zoom
                isSynced
                width={width - marginRight}
                height={height}
                data={data}
                type="multicolorLine"
                xAxisIsPlaybackTime
                yAxes={yAxes}
                plugins={plugins}
                scaleOptions={scaleOptions as any}
                tooltips={tooltips}
              />

              {paths.map(({ value: path, timestampMethod }, index) => (
                <SInputContainer
                  key={index}
                  style={{ top: index * heightPerTopic }}
                  shrink={index === 0 && isHovered}
                >
                  <SInputDelete
                    onClick={() => {
                      const newPaths = config.paths.slice();
                      newPaths.splice(index, 1);
                      saveConfig({ paths: newPaths });
                    }}
                  >
                    ✕
                  </SInputDelete>
                  <MessagePathInput
                    path={path}
                    onChange={onInputChange}
                    index={index}
                    autoSize
                    validTypes={transitionableRosTypes}
                    noMultiSlices
                    timestampMethod={timestampMethod}
                    onTimestampMethodChange={onInputTimestampMethodChange}
                  />
                </SInputContainer>
              ))}
            </SChartContainerInner>
          )}
        </Dimensions>
      </SChartContainerOuter>
    </SRoot>
  );
});

export default Panel<StateTransitionConfig>(
  Object.assign(StateTransitions, {
    panelType: "StateTransitions",
    defaultConfig: { paths: [] },
  }) as any,
);
