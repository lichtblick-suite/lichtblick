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
import { useEffect, useCallback, useMemo, useRef, ComponentProps } from "react";
import { Time, TimeUtil } from "rosbag";

import {
  useBlocksByTopic,
  useDataSourceInfo,
  useMessagesByTopic,
} from "@foxglove-studio/app/PanelAPI";
import Flex from "@foxglove-studio/app/components/Flex";
import { getTopicsFromPaths } from "@foxglove-studio/app/components/MessagePathSyntax/parseRosPath";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import {
  getTooltipItemForMessageHistoryItem,
  TooltipItem,
} from "@foxglove-studio/app/components/TimeBasedChart";
import useShallowMemo from "@foxglove-studio/app/hooks/useShallowMemo";
import PlotChart, {
  getDatasetsAndTooltips,
  PlotDataByPath,
} from "@foxglove-studio/app/panels/Plot/PlotChart";
import PlotLegend from "@foxglove-studio/app/panels/Plot/PlotLegend";
import PlotMenu from "@foxglove-studio/app/panels/Plot/PlotMenu";
import { PanelConfig } from "@foxglove-studio/app/types/panels";
import { fromSec, subtractTimes, toSec } from "@foxglove-studio/app/util/time";

import helpContent from "./index.help.md";
import { PlotConfig } from "./types";

export { plotableRosTypes } from "./types";
export type { PlotConfig, PlotXAxisVal } from "./types";

export function openSiblingPlotPanel(
  openSiblingPanel: (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void,
  topicName: string,
) {
  openSiblingPanel("Plot", (config: PanelConfig) => ({
    ...config,
    paths: uniq(
      config.paths
        .concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }])
        .filter(({ value }: any) => value),
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
  (decodeMessagePathsForMessagesByTopic: any, block: any): PlotDataByPath => {
    return Object.freeze(getPlotDataByPath(decodeMessagePathsForMessagesByTopic(block)));
  },
);

const ZERO_TIME = { sec: 0, nsec: 0 };

function getBlockItemsByPath(decodeMessagePathsForMessagesByTopic: any, blocks: any) {
  const ret = {};
  const lastBlockIndexForPath: any = {};
  blocks.forEach((block: any, i: number) => {
    const messagePathItemsForBlock: PlotDataByPath = getMessagePathItemsForBlock(
      decodeMessagePathsForMessagesByTopic,
      block,
    );
    Object.entries(messagePathItemsForBlock).forEach(([path, messagePathItems]) => {
      const existingItems: TooltipItem[][] = (ret as any)[path] || [];
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
      (ret as any)[path] = existingItems;
      lastBlockIndexForPath[path] = i;
    });
  });
  return ret;
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
  // Note that the below values are refs since they are only used in callbacks and are not rendered anywhere.
  const currentMinY = useRef<number>(ReactNull);
  const currentMaxY = useRef<number>(ReactNull);
  const currentViewWidth = useRef<number>(ReactNull);

  const saveCurrentView = useCallback((minY: number, maxY: number, width: number) => {
    currentMinY.current = minY;
    currentMaxY.current = maxY;
    currentViewWidth.current = width;
  }, []);

  const setWidth = useCallback(
    () =>
      saveConfig({
        followingViewWidth:
          currentViewWidth.current != undefined ? currentViewWidth.current.toString() : "",
      }),
    [saveConfig],
  );

  const setMinMax = useCallback(
    () =>
      saveConfig({
        minYValue: currentMinY.current != undefined ? currentMinY.current.toString() : "",
        maxYValue: currentMaxY.current != undefined ? currentMaxY.current.toString() : "",
      }),
    [currentMaxY, currentMinY, saveConfig],
  );

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
    format: "bobjects",
  });

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(
    memoizedPaths,
  );

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
    return Object.keys(streamedItemsByPath).every(
      (path) => (blockItemsByPath as any)[path] != undefined,
    )
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

  const { currentTime, endTime, seekPlayback: seek } = useMessagePipeline(
    useCallback(
      ({ seekPlayback, playerState: { activeData } }) => ({
        currentTime: activeData?.currentTime,
        endTime: activeData?.endTime,
        seekPlayback,
      }),
      [],
    ),
  );
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
  let defaultView;
  if (preloadingDisplayTime != undefined) {
    if (followingViewWidth != undefined && parseFloat(followingViewWidth) > 0) {
      // Will be ignored in TimeBasedChart for non-preloading plots and non-timestamp plots.
      defaultView = { type: "following", width: parseFloat(followingViewWidth) };
    } else if (preloadingStartTime != undefined && preloadingEndTime != undefined) {
      defaultView = { type: "fixed", minXValue: preloadingStartTime, maxXValue: preloadingEndTime };
    }
  }

  const onClick = useCallback<NonNullable<ComponentProps<typeof PlotChart>["onClick"]>>(
    (params) => {
      const seekSeconds = params.x;
      if (!startTime || seekSeconds == undefined || !seek || xAxisVal !== "timestamp") {
        return;
      }
      // The player validates and clamps the time.
      const seekTime = TimeUtil.add(startTime, fromSec(seekSeconds));
      seek(seekTime);
    },
    [seek, startTime, xAxisVal],
  );

  // console.log(preloadingEndTime);
  return (
    <Flex col clip center style={{ position: "relative" }}>
      <PanelToolbar
        helpContent={helpContent}
        floating
        menuContent={
          <PlotMenu
            displayWidth={followingViewWidth ?? ""}
            minYValue={minYValue}
            maxYValue={maxYValue}
            saveConfig={saveConfig}
            setMinMax={setMinMax}
            setWidth={setWidth}
            datasets={datasets}
            xAxisVal={xAxisVal}
            tooltips={tooltips}
          />
        }
      />
      <PlotChart
        paths={yAxisPaths}
        minYValue={parseFloat(minYValue)}
        maxYValue={parseFloat(maxYValue)}
        saveCurrentView={saveCurrentView as any}
        datasets={datasets}
        tooltips={tooltips}
        xAxisVal={xAxisVal}
        currentTime={preloadingDisplayTime}
        onClick={onClick}
        defaultView={defaultView as any}
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
Plot.panelType = "Plot";
Plot.defaultConfig = {
  paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" as const }],
  minYValue: "",
  maxYValue: "",
  showLegend: true,
  xAxisVal: "timestamp" as const,
};

export default Panel(Plot);
