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

import { compact, uniq } from "lodash";
import memoizeWeak from "memoize-weak";
import { useEffect, useCallback, useMemo, ComponentProps } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import { Time, add } from "@foxglove/rostime";
import {
  useBlocksByTopic,
  useDataSourceInfo,
  useMessagesByTopic,
} from "@foxglove/studio-base/PanelAPI";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksByTopic";
import Flex from "@foxglove/studio-base/components/Flex";
import { getTopicsFromPaths } from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  ChartDefaultView,
  getTooltipItemForMessageHistoryItem,
  TooltipItem,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { PanelConfig, PanelConfigSchema } from "@foxglove/studio-base/types/panels";
import { fromSec, subtractTimes, toSec } from "@foxglove/studio-base/util/time";

import PlotChart from "./PlotChart";
import PlotLegend from "./PlotLegend";
import { getDatasetsAndTooltips } from "./datasets";
import helpContent from "./index.help.md";
import { PlotDataByPath } from "./internalTypes";
import { PlotConfig } from "./types";

export { plotableRosTypes } from "./types";
export type { PlotConfig, PlotXAxisVal } from "./types";

export function openSiblingPlotPanel(
  openSiblingPanel: (type: string, cb: (config: PanelConfig) => PanelConfig) => void,
  topicName: string,
): void {
  openSiblingPanel("Plot", (config: PanelConfig) => ({
    ...config,
    paths: uniq(
      (config as PlotConfig).paths
        .concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }])
        .filter(({ value }) => value),
    ),
  }));
}

type Props = {
  config: PlotConfig;
  saveConfig: (arg0: Partial<PlotConfig>) => void;
};

// messagePathItems contains the whole parsed message, and we don't need to cache all of that.
// Instead, throw away everything but what we need (the timestamps).
const getPlotDataByPath = (itemsByPath: MessageDataItemsByPath): PlotDataByPath => {
  const ret: PlotDataByPath = {};
  Object.entries(itemsByPath).forEach(([path, items]) => {
    ret[path] = [items.map(getTooltipItemForMessageHistoryItem)];
  });
  return ret;
};

const getMessagePathItemsForBlock = memoizeWeak(
  (
    decodeMessagePathsForMessagesByTopic: (_: MessageBlock) => MessageDataItemsByPath,
    block: MessageBlock,
  ): PlotDataByPath => {
    return Object.freeze(getPlotDataByPath(decodeMessagePathsForMessagesByTopic(block)));
  },
);

const ZERO_TIME = { sec: 0, nsec: 0 };

function getBlockItemsByPath(
  decodeMessagePathsForMessagesByTopic: (_: MessageBlock) => MessageDataItemsByPath,
  blocks: readonly MessageBlock[],
) {
  const ret: Record<string, TooltipItem[][]> = {};
  const lastBlockIndexForPath: Record<string, number> = {};
  blocks.forEach((block, i: number) => {
    const messagePathItemsForBlock: PlotDataByPath = getMessagePathItemsForBlock(
      decodeMessagePathsForMessagesByTopic,
      block,
    );
    Object.entries(messagePathItemsForBlock).forEach(([path, messagePathItems]) => {
      const existingItems = ret[path] ?? [];
      // getMessagePathItemsForBlock returns an array of exactly one range of items.
      const [pathItems] = messagePathItems;
      if (lastBlockIndexForPath[path] === i - 1) {
        // If we are continuing directly from the previous block index (i - 1) then add to the
        // existing range, otherwise start a new range
        const currentRange = existingItems[existingItems.length - 1];
        if (currentRange && pathItems) {
          for (const item of pathItems) {
            currentRange.push(item);
          }
        }
      } else {
        if (pathItems) {
          // Start a new contiguous range. Make a copy so we can extend it.
          existingItems.push(pathItems.slice());
        }
      }
      ret[path] = existingItems;
      lastBlockIndexForPath[path] = i;
    });
  });
  return ret;
}

function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime;
}

function selectEndTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.endTime;
}

function selectSeek(ctx: MessagePipelineContext) {
  return ctx.seekPlayback;
}

function Plot(props: Props) {
  const { saveConfig, config } = props;
  const {
    followingViewWidth,
    paths: yAxisPaths,
    minYValue,
    maxYValue,
    showLegend,
    xAxisVal,
    xAxisPath,
  } = config;
  useEffect(() => {
    if (yAxisPaths.length === 0) {
      saveConfig({ paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }] });
    }
  });

  const showSingleCurrentMessage = xAxisVal === "currentCustom" || xAxisVal === "index";
  const historySize = showSingleCurrentMessage ? 1 : Infinity;

  const allPaths = yAxisPaths.map(({ value }) => value).concat(compact([xAxisPath?.value]));
  const memoizedPaths: string[] = useShallowMemo<string[]>(allPaths);
  const subscribeTopics = useMemo(() => getTopicsFromPaths(memoizedPaths), [memoizedPaths]);
  const messagesByTopic = useMessagesByTopic({
    topics: subscribeTopics,
    historySize,
    // This subscription is used for two purposes:
    //  1. A fallback for preloading when blocks are not available (nodes, websocket.)
    //  2. Playback-synced plotting of index/custom data.
    preloadingFallback: !showSingleCurrentMessage,
  });

  const decodeMessagePathsForMessagesByTopic =
    useDecodeMessagePathsForMessagesByTopic(memoizedPaths);

  const streamedItemsByPath = useMemo(
    () => getPlotDataByPath(decodeMessagePathsForMessagesByTopic(messagesByTopic)),
    [decodeMessagePathsForMessagesByTopic, messagesByTopic],
  );

  const { blocks } = useBlocksByTopic(subscribeTopics);
  const blockItemsByPath = useMemo(
    () =>
      showSingleCurrentMessage
        ? {}
        : getBlockItemsByPath(decodeMessagePathsForMessagesByTopic, blocks),
    [showSingleCurrentMessage, decodeMessagePathsForMessagesByTopic, blocks],
  );
  const { startTime } = useDataSourceInfo();

  // If every streaming key is in the blocks, just use the blocks object for a stable identity.
  const mergedItems = useMemo(() => {
    return Object.keys(streamedItemsByPath).every((path) => blockItemsByPath[path] != undefined)
      ? blockItemsByPath
      : { ...streamedItemsByPath, ...blockItemsByPath };
  }, [blockItemsByPath, streamedItemsByPath]);

  // Don't filter out disabled paths when passing into getDatasetsAndTooltips, because we still want
  // easy access to the history when turning the disabled paths back on.
  const { datasets, tooltips, pathsWithMismatchedDataLengths } = useMemo(
    // TODO(steel): This memoization isn't quite ideal: getDatasetsAndTooltips is a bit expensive
    // with lots of preloaded data, and when we preload a new block we re-generate the datasets for
    // the whole timeline. We should try to use block memoization here.
    () =>
      getDatasetsAndTooltips(yAxisPaths, mergedItems, startTime ?? ZERO_TIME, xAxisVal, xAxisPath),
    [yAxisPaths, mergedItems, startTime, xAxisVal, xAxisPath],
  );

  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);
  const seek = useMessagePipeline(selectSeek);

  // Min/max x-values and playback position indicator are only used for preloaded plots. In non-
  // preloaded plots min x-value is always the last seek time, and the max x-value is the current
  // playback time.
  const timeToXValueForPreloading = (t?: Time): number | undefined => {
    if (xAxisVal === "timestamp" && t && startTime) {
      return toSec(subtractTimes(t, startTime));
    }
    return undefined;
  };
  const preloadingDisplayTime = timeToXValueForPreloading(currentTime);
  const preloadingStartTime = timeToXValueForPreloading(startTime); // zero or undefined
  const preloadingEndTime = timeToXValueForPreloading(endTime);
  let defaultView: ChartDefaultView | undefined;
  if (preloadingDisplayTime != undefined) {
    // display time == end time when streamking data..., and start time was 0
    // could use start time of 0 to indicate live stream?
    if (followingViewWidth != undefined && +followingViewWidth > 0) {
      // Will be ignored in TimeBasedChart for non-preloading plots and non-timestamp plots.
      defaultView = { type: "following", width: +followingViewWidth };
    } else if (preloadingStartTime != undefined && preloadingEndTime != undefined) {
      defaultView = { type: "fixed", minXValue: preloadingStartTime, maxXValue: preloadingEndTime };
    }
  }

  const onClick = useCallback<NonNullable<ComponentProps<typeof PlotChart>["onClick"]>>(
    (params) => {
      const seekSeconds = params.x;
      if (!startTime || seekSeconds == undefined || xAxisVal !== "timestamp") {
        return;
      }
      // The player validates and clamps the time.
      const seekTime = add(startTime, fromSec(seekSeconds));
      seek(seekTime);
    },
    [seek, startTime, xAxisVal],
  );

  return (
    <Flex col clip center style={{ position: "relative" }}>
      <PanelToolbar helpContent={helpContent} floating />
      <PlotChart
        paths={yAxisPaths}
        minYValue={parseFloat((minYValue ?? "")?.toString())}
        maxYValue={parseFloat((maxYValue ?? "")?.toString())}
        datasets={datasets}
        tooltips={tooltips}
        xAxisVal={xAxisVal}
        currentTime={preloadingDisplayTime}
        onClick={onClick}
        defaultView={defaultView}
      />
      <PlotLegend
        paths={yAxisPaths}
        saveConfig={saveConfig}
        showLegend={showLegend}
        xAxisVal={xAxisVal}
        xAxisPath={xAxisPath}
        pathsWithMismatchedDataLengths={pathsWithMismatchedDataLengths}
      />
    </Flex>
  );
}

const configSchema: PanelConfigSchema<PlotConfig> = [
  { key: "maxYValue", type: "number", title: "Y max", placeholder: "auto", allowEmpty: true },
  { key: "minYValue", type: "number", title: "Y min", placeholder: "auto", allowEmpty: true },
  {
    key: "followingViewWidth",
    type: "number",
    title: "X range in seconds (for timestamp plots only)",
    placeholder: "auto",
    allowEmpty: true,
    validate: (x) => (x > 0 ? x : undefined),
  },
];

export default Panel(
  Object.assign(Plot, {
    panelType: "Plot",
    defaultConfig: {
      paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" as const }],
      minYValue: "",
      maxYValue: "",
      showLegend: true,
      xAxisVal: "timestamp" as const,
    },
    supportsStrictMode: false,
    configSchema,
  }),
);
