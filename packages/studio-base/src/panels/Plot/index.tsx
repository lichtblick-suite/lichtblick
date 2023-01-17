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

import DownloadIcon from "@mui/icons-material/Download";
import { Typography, useTheme } from "@mui/material";
import { compact, isEmpty, isNumber, uniq } from "lodash";
import memoizeWeak from "memoize-weak";
import { useEffect, useCallback, useMemo, ComponentProps } from "react";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import {
  Time,
  add as addTimes,
  fromSec,
  subtract as subtractTimes,
  toSec,
} from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useBlocksByTopic, useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksByTopic";
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
import PanelToolbar, {
  PANEL_TOOLBAR_MIN_HEIGHT,
} from "@foxglove/studio-base/components/PanelToolbar";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  ChartDefaultView,
  TimeBasedChartTooltipData,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { NewPlotLegend } from "@foxglove/studio-base/panels/Plot/NewPlotLegend";
import { OnClickArg as OnChartClickArgs } from "@foxglove/studio-base/src/components/Chart";
import { OpenSiblingPanel, PanelConfig, SaveConfig } from "@foxglove/studio-base/types/panels";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import PlotChart from "./PlotChart";
import PlotLegend from "./PlotLegend";
import { downloadCSV } from "./csv";
import { getDatasets } from "./datasets";
import { DataSet, PlotDataByPath, PlotDataItem } from "./internalTypes";
import { usePlotPanelSettings } from "./settings";
import { PlotConfig } from "./types";

export { plotableRosTypes } from "./types";
export type { PlotConfig, PlotXAxisVal } from "./types";

const defaultSidebarDimension = 240;

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

type Props = {
  config: PlotConfig;
  saveConfig: SaveConfig<PlotConfig>;
};

// messagePathItems contains the whole parsed message, and we don't need to cache all of that.
// Instead, throw away everything but what we need (the timestamps).
const getPlotDataByPath = (itemsByPath: MessageDataItemsByPath): PlotDataByPath => {
  const ret: PlotDataByPath = {};
  Object.entries(itemsByPath).forEach(([path, items]) => {
    ret[path] = [
      items.map((messageAndData) => {
        const headerStamp = getTimestampForMessage(messageAndData.messageEvent.message);
        return {
          queriedData: messageAndData.queriedData,
          receiveTime: messageAndData.messageEvent.receiveTime,
          headerStamp,
        };
      }),
    ];
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

const performance = window.performance;

/**
 * Builds a lookup map of a compound x:y:index key to a datum, used to map hovered positions
 * on screen to a data point for tooltip display.
 */
function buildTooltipLookupMap(datasets: DataSet[]): Map<string, TimeBasedChartTooltipData> {
  const lookup = new Map<string, TimeBasedChartTooltipData>();
  for (const [index, dataset] of datasets.entries()) {
    for (const datum of dataset.data) {
      lookup.set(`${datum.x}:${datum.y}:${index}`, datum);
    }
  }
  return lookup;
}

function getBlockItemsByPath(
  decodeMessagePathsForMessagesByTopic: (_: MessageBlock) => MessageDataItemsByPath,
  blocks: readonly MessageBlock[],
) {
  const ret: Record<string, PlotDataItem[][]> = {};
  const lastBlockIndexForPath: Record<string, number> = {};
  let count = 0;
  let i = 0;
  for (const block of blocks) {
    const messagePathItemsForBlock: PlotDataByPath = getMessagePathItemsForBlock(
      decodeMessagePathsForMessagesByTopic,
      block,
    );

    // After 1 million data points we check if there is more memory to continue loading more
    // data points. This helps prevent runaway memory use if the user tried to plot a binary topic.
    //
    // An example would be to try plotting `/map.data[:]` where map is an occupancy grid
    // this can easily result in many millions of points.
    if (count >= 1_000_000) {
      // if we have memory stats we can let the user have more points as long as memory is not under pressure
      if (performance.memory) {
        const pct = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (isNaN(pct) || pct > 0.6) {
          return ret;
        }
      } else {
        return ret;
      }
    }

    for (const [path, messagePathItems] of Object.entries(messagePathItemsForBlock)) {
      count += messagePathItems[0]?.[0]?.queriedData.length ?? 0;

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
    }

    i += 1;
  }
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
    minXValue,
    maxXValue,
    minYValue,
    maxYValue,
    showXAxisLabels,
    showYAxisLabels,
    showLegend,
    legendDisplay = config.showSidebar === true ? "left" : "floating",
    showPlotValuesInLegend,
    isSynced,
    xAxisVal,
    xAxisPath,
    sidebarDimension = config.sidebarWidth ?? defaultSidebarDimension,
  } = config;
  const theme = useTheme();

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
    // Apply min/max x-value if either min or max or both is defined.
    if ((isNumber(minXValue) && isNumber(endTimeSinceStart)) || isNumber(maxXValue)) {
      return {
        type: "fixed",
        minXValue: isNumber(minXValue) ? minXValue : 0,
        maxXValue: isNumber(maxXValue) ? maxXValue : endTimeSinceStart ?? 0,
      };
    }
    if (xAxisVal === "timestamp" && startTime && endTimeSinceStart != undefined) {
      return { type: "fixed", minXValue: 0, maxXValue: endTimeSinceStart };
    }
    return undefined;
  }, [maxXValue, minXValue, endTimeSinceStart, startTime, xAxisVal]);

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

  const blocks = useBlocksByTopic(subscribeTopics);

  // This memoization isn't quite ideal: getDatasets is a bit expensive with lots of preloaded data,
  // and when we preload a new block we re-generate the datasets for the whole timeline. We could
  // try to use block memoization here.
  const plotDataForBlocks = useMemo(() => {
    if (showSingleCurrentMessage) {
      return {};
    }
    return getBlockItemsByPath(decodeMessagePathsForMessagesByTopic, blocks);
  }, [blocks, decodeMessagePathsForMessagesByTopic, showSingleCurrentMessage]);

  // When restoring, keep only the paths that are present in allPaths.
  // Without this, the reducer value will grow unbounded with new paths as users add/remove series.
  const restore = useCallback(
    (previous?: PlotDataByPath): PlotDataByPath => {
      if (!previous) {
        return {};
      }

      const updated: PlotDataByPath = {};
      for (const path of allPaths) {
        const plotData = previous[path];
        if (plotData) {
          updated[path] = plotData;
        }
      }

      return updated;
    },
    [allPaths],
  );

  // The addMessages function below is passed to useMessageReducer to handle new messages during
  // playback. If we have messages for a specific path in _blocks_ then we ignore the messages in
  // the reducer.
  //
  // To keep the addMessages function "stable" when loading new blocks we grab only the paths from
  // the blocks and make addMessages depend on the paths. To keep paths referentially stable when
  // the paths values haven't changed we use a shallow memo.
  const blockPaths = useMemo(() => Object.keys(plotDataForBlocks), [plotDataForBlocks]);
  const blockPathsMemo = useShallowMemo(blockPaths);

  const addMessages = useCallback(
    (accumulated: PlotDataByPath, msgEvents: readonly MessageEvent<unknown>[]) => {
      const lastEventTime = msgEvents[msgEvents.length - 1]?.receiveTime;
      const isFollowing = followingView?.type === "following";

      // If we don't change any accumulated data, avoid returning a new "accumulated" object so
      // react hooks remain stable.
      let newAccumulated: PlotDataByPath | undefined;

      for (const msgEvent of msgEvents) {
        const paths = topicToPaths.get(msgEvent.topic);
        if (!paths) {
          continue;
        }

        for (const path of paths) {
          // Skip any paths we already service in plotDataForBlocks.
          // We don't need to accumulate these because the block data takes precedence.
          if (blockPathsMemo.includes(path)) {
            continue;
          }

          const dataItem = cachedGetMessagePathDataItems(path, msgEvent);
          if (!dataItem) {
            continue;
          }

          const headerStamp = getTimestampForMessage(msgEvent.message);
          const plotDataItem = {
            queriedData: dataItem,
            receiveTime: msgEvent.receiveTime,
            headerStamp,
          };

          if (!newAccumulated) {
            newAccumulated = { ...accumulated };
          }

          if (showSingleCurrentMessage) {
            newAccumulated[path] = [[plotDataItem]];
          } else {
            const plotDataPath = newAccumulated[path]?.slice() ?? [[]];
            // PlotDataPaths have 2d arrays of items to accommodate blocks which may have gaps so
            // each continuous set of blocks forms one continuous line. For streaming messages we
            // treat this as one continuous set of items and always add to the first "range"
            const plotDataItems = plotDataPath[0]!;

            // If we are using the _following_ view mode, truncate away any items older than the view window.
            if (lastEventTime && isFollowing) {
              const minStamp = toSec(lastEventTime) - followingView.width;
              const newItems = filterMap(plotDataItems, (item) => {
                if (toSec(item.receiveTime) < minStamp) {
                  return undefined;
                }
                return item;
              });
              newItems.push(plotDataItem);
              plotDataPath[0] = newItems;
            } else {
              plotDataPath[0] = plotDataItems.concat(plotDataItem);
            }

            newAccumulated[path] = plotDataPath;
          }
        }
      }

      return newAccumulated ?? accumulated;
    },
    [
      blockPathsMemo,
      cachedGetMessagePathDataItems,
      followingView,
      showSingleCurrentMessage,
      topicToPaths,
    ],
  );

  // The extra useShallowMemo is useful when seeking. Without it, the reduced value will be reset,
  // and trigger the plot to re-render even if the old value and new value were both empty ({})
  // which happens for fully pre-loaded data coming from blocks.
  const plotDataByPath = useShallowMemo(
    useMessageReducer<PlotDataByPath>({
      topics: subscribeTopics,
      preloadType: "full",
      restore,
      addMessages,
    }),
  );

  // Keep disabled paths when passing into getDatasets, because we still want
  // easy access to the history when turning the disabled paths back on.
  const { datasets, pathsWithMismatchedDataLengths } = useMemo(() => {
    const allPlotData = { ...plotDataByPath, ...plotDataForBlocks };

    return getDatasets({
      paths: yAxisPaths,
      itemsByPath: allPlotData,
      startTime: startTime ?? ZERO_TIME,
      xAxisVal,
      xAxisPath,
      invertedTheme: theme.palette.mode === "dark",
    });
  }, [plotDataByPath, plotDataForBlocks, yAxisPaths, startTime, xAxisVal, xAxisPath, theme]);

  const tooltips = useMemo(() => {
    if (showLegend && showPlotValuesInLegend) {
      return new Map();
    }
    return buildTooltipLookupMap(datasets);
  }, [datasets, showLegend, showPlotValuesInLegend]);

  const messagePipeline = useMessagePipelineGetter();
  const onClick = useCallback<NonNullable<ComponentProps<typeof PlotChart>["onClick"]>>(
    ({ x: seekSeconds }: OnChartClickArgs) => {
      const {
        seekPlayback,
        playerState: { activeData: { startTime: start } = {} },
      } = messagePipeline();
      if (!seekPlayback || !start || seekSeconds == undefined || xAxisVal !== "timestamp") {
        return;
      }
      // Avoid normalizing a negative time if the clicked point had x < 0.
      if (seekSeconds >= 0) {
        seekPlayback(addTimes(start, fromSec(seekSeconds)));
      }
    },
    [messagePipeline, xAxisVal],
  );

  usePlotPanelSettings(config, saveConfig);

  const [seriesSettings = false] = useAppConfigurationValue(
    AppSetting.ENABLE_PLOT_PANEL_SERIES_SETTINGS,
  );

  const stackDirection = useMemo(
    () => (legendDisplay === "top" ? "column" : "row"),
    [legendDisplay],
  );

  return (
    <Stack
      flex="auto"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      <PanelToolbar
        additionalIcons={
          <ToolbarIconButton
            onClick={() => downloadCSV(datasets, xAxisVal)}
            title="Download plot data as CSV"
          >
            <DownloadIcon fontSize="small" />
          </ToolbarIconButton>
        }
      >
        <Typography noWrap variant="body2" color="text.secondary" flex="auto">
          {isEmpty(title) ? "Plot" : title}
        </Typography>
      </PanelToolbar>
      <Stack
        direction={stackDirection}
        flex="auto"
        fullWidth
        style={{ height: `calc(100% - ${PANEL_TOOLBAR_MIN_HEIGHT}px)` }}
      >
        {seriesSettings === false && (
          <PlotLegend
            paths={yAxisPaths}
            datasets={datasets}
            currentTime={currentTimeSinceStart}
            saveConfig={saveConfig}
            showLegend={showLegend}
            xAxisVal={xAxisVal}
            xAxisPath={xAxisPath}
            pathsWithMismatchedDataLengths={pathsWithMismatchedDataLengths}
            legendDisplay={legendDisplay}
            showPlotValuesInLegend={showPlotValuesInLegend}
            sidebarDimension={sidebarDimension}
          />
        )}
        {seriesSettings === true && (
          <NewPlotLegend
            paths={yAxisPaths}
            datasets={datasets}
            currentTime={currentTimeSinceStart}
            saveConfig={saveConfig}
            showLegend={showLegend}
            pathsWithMismatchedDataLengths={pathsWithMismatchedDataLengths}
            legendDisplay={legendDisplay}
            showPlotValuesInLegend={showPlotValuesInLegend}
            sidebarDimension={sidebarDimension}
          />
        )}
        <Stack flex="auto" alignItems="center" justifyContent="center" overflow="hidden">
          <PlotChart
            isSynced={xAxisVal === "timestamp" && isSynced}
            paths={yAxisPaths}
            minYValue={parseFloat((minYValue ?? "").toString())}
            maxYValue={parseFloat((maxYValue ?? "").toString())}
            showXAxisLabels={showXAxisLabels}
            showYAxisLabels={showYAxisLabels}
            datasets={datasets}
            tooltips={tooltips}
            xAxisVal={xAxisVal}
            currentTime={currentTimeSinceStart}
            onClick={onClick}
            defaultView={defaultView}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}

const defaultConfig: PlotConfig = {
  title: "Plot",
  paths: [{ value: "", enabled: true, timestampMethod: "receiveTime" }],
  minYValue: undefined,
  maxYValue: undefined,
  showXAxisLabels: true,
  showYAxisLabels: true,
  showLegend: true,
  legendDisplay: "floating",
  showPlotValuesInLegend: false,
  isSynced: true,
  xAxisVal: "timestamp",
  sidebarDimension: defaultSidebarDimension,
};

export default Panel(
  Object.assign(Plot, {
    panelType: "Plot",
    defaultConfig,
  }),
);
