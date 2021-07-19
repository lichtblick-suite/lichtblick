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

import { ChartOptions, ScaleOptions } from "chart.js";
import { uniq } from "lodash";
import { ComponentProps, useMemo, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import stringHash from "string-hash";
import styled, { css } from "styled-components";
import tinycolor from "tinycolor2";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import Button from "@foxglove/studio-base/components/Button";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import useMessagesByPath from "@foxglove/studio-base/components/MessagePathSyntax/useMessagesByPath";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TimeBasedChart, {
  getTooltipItemForMessageHistoryItem,
  TimeBasedChartTooltipData,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { MONOSPACE } from "@foxglove/studio-base/styles/fonts";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { darkColor, lineColors } from "@foxglove/studio-base/util/plotColors";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";
import { TimestampMethod, subtractTimes, toSec } from "@foxglove/studio-base/util/time";
import { grey } from "@foxglove/studio-base/util/toolsColorScheme";

import helpContent from "./index.help.md";
import positiveModulo from "./positiveModulo";

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

const fontFamily = MONOSPACE;
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

const plugins: ChartOptions["plugins"] = {
  datalabels: {
    display: "auto",
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
  zoom: {
    zoom: {
      enabled: true,
      mode: "x",
      sensitivity: 3,
      speed: 0.1,
    },
    pan: {
      mode: "x",
      enabled: true,
      speed: 20,
      threshold: 10,
    },
  },
};

export type StateTransitionPath = { value: string; timestampMethod: TimestampMethod };
export type StateTransitionConfig = { paths: StateTransitionPath[] };

export function openSiblingStateTransitionsPanel(
  openSiblingPanel: (type: string, cb: (config: PanelConfig) => PanelConfig) => void,
  topicName: string,
): void {
  openSiblingPanel("StateTransitions", (config: PanelConfig) => {
    return {
      ...config,
      paths: uniq(
        (config as StateTransitionConfig).paths.concat([
          { value: topicName, timestampMethod: "receiveTime" },
        ]),
      ),
    };
  });
}

type Props = {
  config: StateTransitionConfig;
  saveConfig: (arg0: Partial<StateTransitionConfig>) => void;
};

const StateTransitions = React.memo(function StateTransitions(props: Props) {
  const { config, saveConfig } = props;
  const { paths } = config;

  const onInputChange = (value: string, index?: number) => {
    if (index == undefined) {
      throw new Error("index not set");
    }
    const newPaths = config.paths.slice();
    const newPath = newPaths[index];
    if (newPath) {
      newPaths[index] = { ...newPath, value: value.trim() };
    }
    saveConfig({ paths: newPaths });
  };

  const onInputTimestampMethodChange = (value: TimestampMethod, index: number | undefined) => {
    if (index == undefined) {
      throw new Error("index not set");
    }
    const newPaths = config.paths.slice();
    const newPath = newPaths[index];
    if (newPath) {
      newPaths[index] = { ...newPath, timestampMethod: value };
    }
    saveConfig({ paths: newPaths });
  };

  const [defaultStart] = useState({ sec: 0, nsec: 0 });
  const { startTime = defaultStart } = PanelAPI.useDataSourceInfo();
  const itemsByPath = useMessagesByPath(useMemo(() => paths.map(({ value }) => value), [paths]));

  const { height, heightPerTopic } = useMemo(() => {
    const onlyTopicsHeight = paths.length * 55;
    const xAxisHeight = 30;
    return {
      height: Math.max(80, onlyTopicsHeight + xAxisHeight),
      heightPerTopic: onlyTopicsHeight / paths.length,
    };
  }, [paths.length]);

  const baseColors = useMemo(() => {
    return [grey, ...lineColors];
  }, []);

  const { datasets, tooltips, maxY } = useMemo(() => {
    let outMaxY: number | undefined;

    const outTooltips: TimeBasedChartTooltipData[] = [];
    const outDatasets: typeof data["datasets"] = [];

    let pathIndex = 0;
    for (const path of paths) {
      const { value: pathValue, timestampMethod } = path;

      let prevQueryValue;
      let previousTimestamp;
      let currentData: typeof outDatasets[0]["data"] = [];
      for (const itemByPath of itemsByPath[pathValue] ?? []) {
        const item = getTooltipItemForMessageHistoryItem(itemByPath);
        const timestamp = timestampMethod === "headerStamp" ? item.headerStamp : item.receiveTime;
        if (!timestamp) {
          continue;
        }

        const queriedData = item.queriedData[0];
        if (item.queriedData.length !== 1 || !queriedData) {
          continue;
        }

        const { constantName, value } = queriedData;

        // Skip duplicates.
        if (
          previousTimestamp &&
          toSec(subtractTimes(previousTimestamp, timestamp)) === 0 &&
          prevQueryValue === value
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
        const color =
          baseColors[positiveModulo(valueForColor, Object.values(baseColors).length)] ?? "grey";

        const x = toSec(subtractTimes(timestamp, startTime));

        // y axis values are set based on the path we are rendering
        const y = (pathIndex + 1) * 6;
        outMaxY = Math.max(outMaxY ?? y, y + 3);

        const element = {
          x,
          y,
        };

        const tooltip: TimeBasedChartTooltipData = {
          x,
          y,
          item,
          path: pathValue,
          value,
          constantName,
          startTime,
        };
        outTooltips.unshift(tooltip);

        // the current point is added even if different from previous value to avoid _gaps_ in the data
        // this is a myproduct of using separate datasets to render each color
        currentData.push({
          x,
          y,
        });

        // if the value is different from previous value, make a new dataset
        if (value !== prevQueryValue) {
          const label =
            constantName != undefined ? `${constantName} (${String(value)})` : String(value);

          const elementWithLabel = {
            ...element,
            label,
            labelColor: color,
          };

          // new data starts with our current point, the current point
          currentData = [elementWithLabel];
          const dataset: typeof data["datasets"][0] = {
            borderWidth: 10,
            borderColor: color,
            data: currentData,
            label: pathIndex.toString(),
            pointBackgroundColor: darkColor(color),
            pointBorderColor: "transparent",
            pointHoverRadius: 3,
            pointRadius: 1.25,
            pointStyle: "circle",
            showLine: true,
            datalabels: {
              color,
            },
          };

          outDatasets.push(dataset);
        }

        prevQueryValue = value;
      }

      ++pathIndex;
    }

    return {
      datasets: outDatasets,
      tooltips: outTooltips,
      maxY: outMaxY,
    };
  }, [baseColors, itemsByPath, paths, startTime]);

  const data: ComponentProps<typeof TimeBasedChart>["data"] = {
    datasets,
  };

  const yScale = useMemo<ScaleOptions>(() => {
    return {
      ticks: {
        // Hide all y-axis ticks since each bar on the y-axis is just a separate path.
        display: false,
      },
      type: "linear",
      min: 3,
      max: maxY,
    };
  }, [maxY]);

  const xScale = useMemo<ScaleOptions>(() => {
    return {
      type: "linear",
    };
  }, []);

  const { width, ref: sizeRef } = useResizeDetector({
    handleHeight: false,
  });

  return (
    <SRoot>
      <PanelToolbar floating helpContent={helpContent} />
      <SAddButton show={true}>
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
        <SChartContainerInner style={{ height }} ref={sizeRef}>
          <TimeBasedChart
            zoom
            isSynced
            width={width ?? 0}
            height={height}
            data={data}
            type="scatter"
            xAxes={xScale}
            xAxisIsPlaybackTime
            yAxes={yScale}
            plugins={plugins}
            tooltips={tooltips}
          />

          {paths.map(({ value: path, timestampMethod }, index) => (
            <SInputContainer
              key={index}
              style={{ top: index * heightPerTopic }}
              shrink={index === 0}
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
      </SChartContainerOuter>
    </SRoot>
  );
});

export default Panel(
  Object.assign(StateTransitions, {
    panelType: "StateTransitions",
    defaultConfig: { paths: [] },
    supportsStrictMode: false,
  }),
);
