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

import { filterMap } from "@foxglove/den/collection";
import {
  Time,
  add as addTimes,
  fromSec,
  subtract as subtractTimes,
  toSec,
} from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { useBlocksByTopic, useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksByTopic";
import Flex from "@foxglove/studio-base/components/Flex";
import parseRosPath, {
  getTopicsFromPaths,
} from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  MessageDataItemsByPath,
  useCachedGetMessagePathDataItems,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  ChartDefaultView,
  TimeBasedChartTooltipData,
  getTooltipItemForMessageHistoryItem,
  TooltipItem,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { OnClickArg as OnChartClickArgs } from "@foxglove/studio-base/src/components/Chart";
import {
  OpenSiblingPanel,
  PanelConfig,
  PanelConfigSchema,
} from "@foxglove/studio-base/types/panels";
import { downloadFiles } from "@foxglove/studio-base/util/download";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import PlotChart from "./PlotChart";
import PlotLegend from "./PlotLegend";
import { getDatasetsAndTooltips } from "./datasets";
import helpContent from "./index.help.md";
import { DataSet, PlotDataByPath } from "./internalTypes";
import { PlotConfig, PlotXAxisVal } from "./types";

export { plotableRosTypes } from "./types";
export type { PlotConfig, PlotXAxisVal } from "./types";

export function openSiblingPlotPanel(openSiblingPanel: OpenSiblingPanel, topicName: string): void {
  openSiblingPanel({
    panelType: "Plot",
    updateIfExists: true,
    siblingConfigCreator: (config: PanelConfig) => ({
      ...config,
      paths: uniq(
        (config as PlotConfig).paths
          .concat([{ value: topicName, enabled: true, timestampMethod: "receiveTime" }])
          .filter(({ value }) => value),
      ),
    }),
  });
}

function getCSVRow(
  data: { x: number; y: number },
  label?: string,
  tooltips?: TimeBasedChartTooltipData[],
) {
  const { x, y } = data ?? {};
  const tooltip = (tooltips ?? []).find(
    (_tooltip) => _tooltip.path === label && _tooltip.x === x && _tooltip.y === y,
  );
  if (!tooltip) {
    throw new Error("Cannot find tooltip for dataset: this should never happen");
  }
  const { receiveTime, headerStamp } = tooltip.item;
  const receiveTimeFloat = formatTimeRaw(receiveTime);
  const stampTime = headerStamp ? formatTimeRaw(headerStamp) : "";
  return [x, receiveTimeFloat, stampTime, label, y];
}

const getCVSColName = (xAxisVal: PlotXAxisVal): string =>
  ({
    timestamp: "elapsed time",
    index: "index",
    custom: "x value",
    currentCustom: "x value",
  }[xAxisVal]);

function getCSVData(
  datasets: DataSet[],
  tooltips: TimeBasedChartTooltipData[],
  xAxisVal: PlotXAxisVal,
): string {
  const headLine = [getCVSColName(xAxisVal), "receive time", "header.stamp", "topic", "value"];
  const combinedLines = [];
  combinedLines.push(headLine);
  datasets.forEach((dataset) => {
    dataset.data.forEach((data) => {
      combinedLines.push(getCSVRow(data as { x: number; y: number }, dataset.label, tooltips));
    });
  });
  return combinedLines.join("\n");
}

function downloadCSV(
  datasets: DataSet[],
  tooltips: TimeBasedChartTooltipData[],
  xAxisVal: PlotXAxisVal,
) {
  const csvData = getCSVData(datasets, tooltips, xAxisVal);
  const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  downloadFiles([{ blob, fileName: `plot_data.csv` }]);
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

function selectStartTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.startTime;
}

function selectCurrentTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.currentTime;
}

function selectEndTime(ctx: MessagePipelineContext) {
  return ctx.playerState.activeData?.endTime;
}

function Plot(props: Props) {
  const { saveConfig, config } = props;
  const {
    title,
    followingViewWidth,
    paths: yAxisPaths,
    minYValue,
    maxYValue,
    showLegend,
    isSynced,
    xAxisVal,
    xAxisPath,
  } = config;

  useEffect(() => {
    if (yAxisPaths.length === 0) {
      saveConfig({ paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }] });
    }
  }, [saveConfig, yAxisPaths.length]);

  const showSingleCurrentMessage = xAxisVal === "currentCustom" || xAxisVal === "index";

  const startTime = useMessagePipeline(selectStartTime);
  const currentTime = useMessagePipeline(selectCurrentTime);
  const endTime = useMessagePipeline(selectEndTime);

  // Min/max x-values and playback position indicator are only used for preloaded plots. In non-
  // preloaded plots min x-value is always the last seek time, and the max x-value is the current
  // playback time.
  const timeSincePreloadedStart = (time?: Time): number | undefined => {
    if (xAxisVal === "timestamp" && time && startTime) {
      return toSec(subtractTimes(time, startTime));
    }
    return undefined;
  };

  const currentTimeSinceStart = timeSincePreloadedStart(currentTime);

  const followingView = useMemo<ChartDefaultView | undefined>(() => {
    if (followingViewWidth != undefined && +followingViewWidth > 0) {
      return { type: "following", width: +followingViewWidth };
    }
    return undefined;
  }, [followingViewWidth]);

  const endTimeSinceStart = timeSincePreloadedStart(endTime);
  const fixedView = useMemo<ChartDefaultView | undefined>(() => {
    if (xAxisVal === "timestamp" && startTime && endTimeSinceStart != undefined) {
      return { type: "fixed", minXValue: 0, maxXValue: endTimeSinceStart };
    }
    return undefined;
  }, [endTimeSinceStart, startTime, xAxisVal]);

  // following view and fixed view are split to keep defaultView identity stable when possible
  const defaultView = useMemo<ChartDefaultView | undefined>(() => {
    if (followingView) {
      return followingView;
    } else if (fixedView) {
      return fixedView;
    }
    return undefined;
  }, [fixedView, followingView]);

  const allPaths = useMemo(() => {
    return yAxisPaths.map(({ value }) => value).concat(compact([xAxisPath?.value]));
  }, [xAxisPath?.value, yAxisPaths]);

  const subscribeTopics = useMemo(() => getTopicsFromPaths(allPaths), [allPaths]);

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(allPaths);
  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(allPaths);

  // When iterating message events, we need a reverse lookup from topic to the paths that requested
  // the topic.
  const topicToPaths = useMemo<Map<string, string[]>>(() => {
    const out = new Map<string, string[]>();
    for (const path of allPaths) {
      const rosPath = parseRosPath(path);
      if (!rosPath) {
        continue;
      }
      const existing = out.get(rosPath.topicName) ?? [];
      existing.push(path);
      out.set(rosPath.topicName, existing);
    }
    return out;
  }, [allPaths]);

  const restore = useCallback((): PlotDataByPath => {
    return {};
  }, []);

  const addMessages = useCallback(
    (accumulated: PlotDataByPath, msgEvents: readonly MessageEvent<unknown>[]) => {
      for (const msgEvent of msgEvents) {
        const paths = topicToPaths.get(msgEvent.topic);
        if (!paths) {
          continue;
        }

        for (const path of paths) {
          const dataItem = cachedGetMessagePathDataItems(path, msgEvent);
          if (!dataItem) {
            continue;
          }

          const tooltipItem = getTooltipItemForMessageHistoryItem({
            message: msgEvent,
            queriedData: dataItem,
          });

          if (showSingleCurrentMessage) {
            accumulated[path] = [[tooltipItem]];
          } else {
            const plotDataPath = (accumulated[path] ??= [[]]);
            // PlotDataPaths have 2d arrays of tooltip items to accomodate blocks which may have gaps
            // so each continuous set of blocks forms one set of tooltip items.
            // For streaming messages we treat this as one continuous set of items and always add
            // to the first "range"
            plotDataPath[0]!.push(tooltipItem);
          }
        }
      }

      return { ...accumulated };
    },
    [cachedGetMessagePathDataItems, showSingleCurrentMessage, topicToPaths],
  );

  const plotDataByPath = useMessageReducer<PlotDataByPath>({
    topics: subscribeTopics,
    restore,
    addMessages,
  });

  // filter down the message history to the follow window
  const filteredPlotData = useMemo(() => {
    if (followingView?.type !== "following" || currentTime == undefined) {
      return plotDataByPath;
    }

    const filteredByPath: typeof plotDataByPath = {};

    const minStamp = toSec(currentTime) - followingView.width;
    for (const [path, plotDataItems] of Object.entries(plotDataByPath)) {
      const newArr = [];
      for (const tooltipArr of plotDataItems) {
        const filtered = filterMap(tooltipArr, (tooltip) => {
          if (toSec(tooltip.receiveTime) < minStamp) {
            return undefined;
          }
          return tooltip;
        });
        if (filtered.length > 0) {
          newArr.push(filtered);
        }
      }

      filteredByPath[path] = newArr;
    }
    return filteredByPath;
  }, [currentTime, followingView, plotDataByPath]);

  const blocks = useBlocksByTopic(subscribeTopics);

  // This memoization isn't quite ideal: getDatasetsAndTooltips is a bit expensive
  // with lots of preloaded data, and when we preload a new block we re-generate the datasets for
  // the whole timeline. We could try to use block memoization here.
  const plotDataForBlocks = useMemo(() => {
    if (showSingleCurrentMessage) {
      return {};
    }
    return getBlockItemsByPath(decodeMessagePathsForMessagesByTopic, blocks);
  }, [blocks, decodeMessagePathsForMessagesByTopic, showSingleCurrentMessage]);

  // Keep disabled paths when passing into getDatasetsAndTooltips, because we still want
  // easy access to the history when turning the disabled paths back on.
  const { datasets, tooltips, pathsWithMismatchedDataLengths } = useMemo(() => {
    const allPlotData = { ...filteredPlotData, ...plotDataForBlocks };

    return getDatasetsAndTooltips(
      yAxisPaths,
      allPlotData,
      startTime ?? ZERO_TIME,
      xAxisVal,
      xAxisPath,
    );
  }, [filteredPlotData, plotDataForBlocks, yAxisPaths, startTime, xAxisVal, xAxisPath]);

  const messagePipeline = useMessagePipelineGetter();
  const onClick = useCallback<NonNullable<ComponentProps<typeof PlotChart>["onClick"]>>(
    (params: OnChartClickArgs) => {
      const seekSeconds = params.x;
      const { startTime: start } = messagePipeline().playerState.activeData ?? {};
      const { seekPlayback } = messagePipeline();
      if (!start || seekSeconds == undefined || xAxisVal !== "timestamp") {
        return;
      }
      // The player validates and clamps the time.
      const seekTime = addTimes(start, fromSec(seekSeconds));
      seekPlayback(seekTime);
    },
    [messagePipeline, xAxisVal],
  );

  return (
    <Flex col clip center style={{ position: "relative" }}>
      <PanelToolbar helpContent={helpContent} floating />
      {title && <div>{title}</div>}
      <PlotChart
        isSynced={xAxisVal === "timestamp" && isSynced}
        paths={yAxisPaths}
        minYValue={parseFloat((minYValue ?? "")?.toString())}
        maxYValue={parseFloat((maxYValue ?? "")?.toString())}
        datasets={datasets}
        tooltips={tooltips}
        xAxisVal={xAxisVal}
        currentTime={currentTimeSinceStart}
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
        onDownload={() => downloadCSV(datasets, tooltips, xAxisVal)}
      />
    </Flex>
  );
}

const configSchema: PanelConfigSchema<PlotConfig> = [
  { key: "title", type: "text", title: "Title", placeholder: "Untitled" },
  {
    key: "isSynced",
    type: "toggle",
    title: "Sync with other timestamp-based plots",
  },
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

const defaultConfig: PlotConfig = {
  title: undefined,
  paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }],
  minYValue: "",
  maxYValue: "",
  showLegend: true,
  isSynced: true,
  xAxisVal: "timestamp",
};

export default Panel(
  Object.assign(Plot, {
    panelType: "Plot",
    defaultConfig,
    supportsStrictMode: false,
    configSchema,
  }),
);
