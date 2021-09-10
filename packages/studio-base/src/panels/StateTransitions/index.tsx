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
import { useCallback, useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";
import styled, { css } from "styled-components";
import tinycolor from "tinycolor2";

import { useShallowMemo } from "@foxglove/hooks";
import { add as addTimes, fromSec, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import { useBlocksByTopic } from "@foxglove/studio-base/PanelAPI";
import Button from "@foxglove/studio-base/components/Button";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { getTopicsFromPaths } from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { useDecodeMessagePathsForMessagesByTopic } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import useMessagesByPath from "@foxglove/studio-base/components/MessagePathSyntax/useMessagesByPath";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TimeBasedChart, {
  TimeBasedChartTooltipData,
} from "@foxglove/studio-base/components/TimeBasedChart";
import {
  ChartData,
  OnClickArg as OnChartClickArgs,
} from "@foxglove/studio-base/src/components/Chart";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

import helpContent from "./index.help.md";
import messagesToDatasets from "./messagesToDatasets";
import { StateTransitionPath } from "./types";

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

const fontFamily = fonts.MONOSPACE;
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

function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime;
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

  const pathStrings = useMemo(() => paths.map(({ value }) => value), [paths]);
  const subscribeTopics = useMemo(() => getTopicsFromPaths(pathStrings), [pathStrings]);

  const { startTime } = PanelAPI.useDataSourceInfo();
  const currentTime = useMessagePipeline(selectCurrentTime);
  const currentTimeSinceStart = useMemo(
    () => (!currentTime || !startTime ? undefined : toSec(subtractTimes(currentTime, startTime))),
    [currentTime, startTime],
  );
  const itemsByPath = useMessagesByPath(pathStrings);

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);

  const blocks = useBlocksByTopic(subscribeTopics);
  const decodedBlocks = useMemo(
    () => blocks.map(decodeMessagePathsForMessagesByTopic),
    [blocks, decodeMessagePathsForMessagesByTopic],
  );

  const { height, heightPerTopic } = useMemo(() => {
    const onlyTopicsHeight = paths.length * 55;
    const xAxisHeight = 30;
    return {
      height: Math.max(80, onlyTopicsHeight + xAxisHeight),
      heightPerTopic: onlyTopicsHeight / paths.length,
    };
  }, [paths.length]);

  const { datasets, tooltips, minY } = useMemo(() => {
    let outMinY: number | undefined;

    const outTooltips: TimeBasedChartTooltipData[] = [];
    const outDatasets: ChartData["datasets"] = [];

    // ignore all data when we don't have a start time
    if (!startTime) {
      return {
        datasets: outDatasets,
        tooltips: outTooltips,
        minY: outMinY,
      };
    }

    let pathIndex = 0;
    for (const path of paths) {
      // y axis values are set based on the path we are rendering
      // negative makes each path render below the previous
      const y = (pathIndex + 1) * 6 * -1;
      outMinY = Math.min(outMinY ?? y, y - 3);

      const blocksForPath = decodedBlocks.map((decodedBlock) => decodedBlock[path.value]);

      {
        const { datasets: newDataSets, tooltips: newTooltips } = messagesToDatasets({
          path,
          startTime,
          y,
          pathIndex,
          blocks: blocksForPath,
        });

        outDatasets.push(...newDataSets);
        outTooltips.push(...newTooltips);
      }

      // If we have have messages in blocks for this path, we ignore streamed messages and only
      // display the messages from blocks.
      const haveBlocksForPath = blocksForPath.some((item) => item != undefined);
      if (haveBlocksForPath) {
        continue;
      }

      const items = itemsByPath[path.value];
      if (items) {
        const { datasets: newDataSets, tooltips: newTooltips } = messagesToDatasets({
          path,
          startTime,
          y,
          pathIndex,
          blocks: [items],
        });
        outDatasets.push(...newDataSets);
        outTooltips.push(...newTooltips);
      }

      ++pathIndex;
    }

    return {
      datasets: outDatasets,
      tooltips: outTooltips,
      minY: outMinY,
    };
  }, [itemsByPath, decodedBlocks, paths, startTime]);

  const yScale = useMemo<ScaleOptions>(() => {
    return {
      ticks: {
        // Hide all y-axis ticks since each bar on the y-axis is just a separate path.
        display: false,
      },
      type: "linear",
      min: minY,
      max: -3,
    };
  }, [minY]);

  const xScale = useMemo<ScaleOptions>(() => {
    return {
      type: "linear",
    };
  }, []);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref: sizeRef } = useResizeDetector({
    handleHeight: false,
    refreshRate: 0,
    refreshMode: "debounce",
  });

  const messagePipeline = useMessagePipelineGetter();
  const onClick = useCallback(
    ({ x: seekSeconds }: OnChartClickArgs) => {
      const { startTime: start } = messagePipeline().playerState.activeData ?? {};
      const { seekPlayback } = messagePipeline();
      if (seekSeconds == undefined || start == undefined) {
        return;
      }
      const seekTime = addTimes(start, fromSec(seekSeconds));
      seekPlayback(seekTime);
    },
    [messagePipeline],
  );

  const data: ChartData = useShallowMemo({ datasets });

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
            onClick={onClick}
            currentTime={currentTimeSinceStart}
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

const defaultConfig: PanelConfig = { paths: [] };
export default Panel(
  Object.assign(StateTransitions, {
    panelType: "StateTransitions",
    defaultConfig,
    supportsStrictMode: false,
  }),
);
