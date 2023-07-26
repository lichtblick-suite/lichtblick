// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { groupBy, intersection, isEmpty, mapValues } from "lodash";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLatest } from "react-use";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import { isGreaterThan, isLessThan, isTimeInRangeInclusive, subtract } from "@foxglove/rostime";
import { Immutable, Subscription, Time } from "@foxglove/studio";
import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import parseRosPath, {
  getTopicsFromPaths,
} from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  useCachedGetMessagePathDataItems,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDefaultView } from "@foxglove/studio-base/components/TimeBasedChart";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { derivative } from "@foxglove/studio-base/panels/Plot/transformPlotRange";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { Bounds, makeInvertedBounds, unionBounds } from "@foxglove/studio-base/types/Bounds";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import { calculateDatasetBounds } from "./datasets";
import { BasePlotPath, DataSet, PlotDataByPath, PlotPath, PlotXAxisVal } from "./internalTypes";
import * as maps from "./maps";
import {
  EmptyPlotData,
  PlotData,
  appendPlotData,
  buildPlotData,
  reducePlotData,
  getByPath,
} from "./plotData";
import { useAllFramesByTopic } from "./useAllFramesByTopic";

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });

const EmptyAllFrames: Immutable<Record<string, MessageEvent[]>> = Object.freeze({});

type TaggedPlotData = { tag: string; data: Immutable<PlotData> };

type Params = Immutable<{
  allPaths: string[];
  followingView: undefined | ChartDefaultView;
  showSingleCurrentMessage: boolean;
  startTime: undefined | Time;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  yAxisPaths: PlotPath[];
}>;

type State = Immutable<{
  allFrames: Record<string, Immutable<MessageEvent[]>>;
  allPaths: readonly string[];
  cursors: Record<string, number>;
  data: PlotData;
  globalVariables: GlobalVariables;
  subscriptions: Subscription[];
  xAxisVal: PlotXAxisVal;
  xAxisPath: undefined | BasePlotPath;
}>;

/**
 * Applies the @derivative modifier to the dataset. This has to be done on the complete
 * dataset, not calculated incrementally.
 */
function applyDerivativeToPlotData(data: Immutable<PlotData>): Immutable<PlotData> {
  return {
    ...data,
    datasetsByPath: maps.mapValues(data.datasetsByPath, (dataset, path) => {
      if (path.value.endsWith(".@derivative")) {
        return {
          ...dataset,
          data: derivative(dataset.data),
        };
      } else {
        return dataset;
      }
    }),
  };
}

/**
 * Sorts datsets by header stamp, which at this point in the processing chain is the x value of each point.
 * This has to be done on the complete dataset, not point by point.
 *
 * Messages are provided in receive time order but header stamps might be out of order
 * This would create zig-zag lines connecting the wrong points. Sorting the header stamp values (x)
 * results in the datums being in the correct order for connected lines.
 *
 * An example is when messages at the same receive time have different header stamps. The receive
 * time ordering is undefined (could be different for different data sources), but the header stamps
 * still need sorting so the plot renders correctly.
 */
function sortPlotDataByHeaderStamp(data: Immutable<PlotData>): Immutable<PlotData> {
  const processedDatasets = maps.mapValues(data.datasetsByPath, (dataset, path) => {
    if (path.timestampMethod !== "headerStamp") {
      return dataset;
    }

    return { ...dataset, data: dataset.data.slice().sort((a, b) => a.x - b.x) };
  });

  return { ...data, datasetsByPath: processedDatasets };
}

function makeInitialState(): State {
  return {
    allFrames: {},
    allPaths: [],
    cursors: {},
    data: EmptyPlotData,
    globalVariables: {},
    subscriptions: [],
    xAxisVal: "timestamp",
    xAxisPath: undefined,
  };
}

/**
 * Collates and combines data from alLFrames and currentFrame messages.
 */
export function usePlotPanelData(params: Params): Immutable<{
  bounds: Bounds;
  datasets: DataSet[];
  pathsWithMismatchedDataLengths: string[];
}> {
  const {
    allPaths,
    followingView,
    showSingleCurrentMessage,
    startTime,
    xAxisPath,
    xAxisVal,
    yAxisPaths,
  } = params;

  const theme = useTheme();

  // When iterating message events, we need a reverse lookup from topic to the
  // paths that requested the topic.
  const topicToPaths = useMemo(
    () => groupBy(allPaths, (path) => parseRosPath(path)?.topicName),
    [allPaths],
  );

  const subscribeTopics = useShallowMemo(getTopicsFromPaths(allPaths));

  const subscriptions: Subscription[] = useMemo(() => {
    return subscribeTopics.map((topic) => ({ topic, preload: true }));
  }, [subscribeTopics]);

  const [state, setState] = useState(makeInitialState);

  const allFramesByTopic = useAllFramesByTopic(subscribeTopics);

  const allFrames = showSingleCurrentMessage ? EmptyAllFrames : allFramesByTopic;

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(allPaths);

  const { globalVariables } = useGlobalVariables();

  // Resets all data when global variables change. This could be more fine grained and parse the
  // paths to only rebuild when variables change that are referenced in plot paths.
  const resetDatasets =
    allPaths !== state.allPaths ||
    xAxisVal !== state.xAxisVal ||
    xAxisPath !== state.xAxisPath ||
    globalVariables !== state.globalVariables;

  if (allFrames !== state.allFrames || resetDatasets) {
    // use setState directly instead of useEffect to skip an extra render.
    setState((oldState) => {
      const newState = resetDatasets ? makeInitialState() : oldState;

      const newFramesByTopic = mapValues(allFrames, (messages, topic) =>
        messages.slice(newState.cursors[topic] ?? 0),
      );

      const newCursors = mapValues(allFrames, (messages) => messages.length);

      const newBlockItems = getByPath(decodeMessagePathsForMessagesByTopic(newFramesByTopic));

      const anyNewFrames = Object.values(newFramesByTopic).some((msgs) => msgs.length > 0);

      const newPlotData = anyNewFrames
        ? buildPlotData({
            paths: yAxisPaths,
            itemsByPath: newBlockItems,
            startTime: startTime ?? ZERO_TIME,
            xAxisVal,
            xAxisPath,
            invertedTheme: theme.palette.mode === "dark",
          })
        : EmptyPlotData;

      return {
        allFrames,
        allPaths,
        cursors: newCursors,
        data: appendPlotData(newState.data, newPlotData),
        globalVariables,
        subscriptions,
        xAxisPath,
        xAxisVal,
      };
    });
  }

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(allPaths);

  const restore = useCallback(
    (previous?: TaggedPlotData): TaggedPlotData => {
      if (!previous) {
        // If we're showing single frames, we don't want to accumulate chunks of messages
        // across multiple frames, so we put everything into a single restore tag and
        // each new frame replaces the old one.
        const tag = showSingleCurrentMessage ? "single" : new Date().toISOString();
        return { tag, data: EmptyPlotData };
      }

      // Discard datasets no longer in current y paths and recompute bounds and mismatched
      // paths so we don't hang onto data we no longer need.
      const newYPathValues = yAxisPaths.map((path) => path.value);
      const retainedDataSets = maps.pick(previous.data.datasetsByPath, yAxisPaths);
      const newMismatchedPaths = intersection(
        previous.data.pathsWithMismatchedDataLengths,
        newYPathValues,
      );
      const newBounds = filterMap([...retainedDataSets.values()], calculateDatasetBounds).reduce(
        unionBounds,
        makeInvertedBounds(),
      );

      return {
        tag: previous.tag,
        data: {
          bounds: newBounds,
          datasetsByPath: retainedDataSets,
          pathsWithMismatchedDataLengths: newMismatchedPaths,
        },
      };
    },
    [showSingleCurrentMessage, yAxisPaths],
  );

  // Access allFrames by reference to avoid invalidating the addMessages callback.
  const latestAllFrames = useLatest(allFrames);

  const addMessages = useCallback(
    (accumulated: TaggedPlotData, msgEvents: Immutable<MessageEvent[]>) => {
      const lastEventTime = msgEvents.at(-1)?.receiveTime;
      const isFollowing = followingView?.type === "following";
      const newMessages: PlotDataByPath = {};

      for (const msgEvent of msgEvents) {
        const paths = topicToPaths[msgEvent.topic];
        if (!paths) {
          continue;
        }

        for (const path of paths) {
          const dataItem = cachedGetMessagePathDataItems(path, msgEvent);
          if (!dataItem) {
            continue;
          }

          const headerStamp = getTimestampForMessage(msgEvent.message);

          const allFramesForPathStart = latestAllFrames.current[path]?.at(0)?.receiveTime;
          const allFramesForPathEnd = latestAllFrames.current[path]?.at(-1)?.receiveTime;
          if (
            allFramesForPathStart &&
            allFramesForPathEnd &&
            isTimeInRangeInclusive(msgEvent.receiveTime, allFramesForPathStart, allFramesForPathEnd)
          ) {
            // Skip messages that fall within the range of our allFrames data since we
            // would just filter them out later anyway. Note that this assumes allFrames
            // are loaded contiguously starting from the beginning of message data.
            continue;
          }

          const plotDataItem = {
            queriedData: dataItem,
            receiveTime: msgEvent.receiveTime,
            headerStamp,
          };

          if (showSingleCurrentMessage) {
            newMessages[path] = [plotDataItem];
          } else {
            let plotDataPath = newMessages[path]?.slice() ?? [];
            const plotDataItems = plotDataPath;
            // If we are using the _following_ view mode, truncate away any
            // items older than the view window.
            if (lastEventTime && isFollowing) {
              const minStamp = subtract(lastEventTime, { sec: followingView.width, nsec: 0 });
              const newItems = plotDataItems.filter(
                (item) => !isLessThan(item.receiveTime, minStamp),
              );
              newItems.push(plotDataItem);
              plotDataPath = newItems;
            } else {
              plotDataPath = plotDataItems.concat(plotDataItem);
            }

            newMessages[path] = plotDataPath;
          }
        }
      }

      if (isEmpty(newMessages)) {
        return accumulated;
      }

      const newPlotData = buildPlotData({
        paths: yAxisPaths,
        itemsByPath: newMessages,
        startTime: startTime ?? ZERO_TIME,
        xAxisVal,
        xAxisPath,
        invertedTheme: theme.palette.mode === "dark",
      });

      return {
        tag: accumulated.tag,
        data: showSingleCurrentMessage
          ? newPlotData
          : appendPlotData(accumulated.data, newPlotData),
      };
    },
    [
      cachedGetMessagePathDataItems,
      followingView,
      latestAllFrames,
      showSingleCurrentMessage,
      startTime,
      theme.palette.mode,
      topicToPaths,
      xAxisPath,
      xAxisVal,
      yAxisPaths,
    ],
  );

  const currentFrameData = useMessageReducer<TaggedPlotData>({
    topics: subscribeTopics,
    preloadType: "full",
    restore,
    addMessages,
  });

  // Accumulate separate message playback sequences into distinct intervals we
  // can later combine into a single combined set of message data.
  const [accumulatedPathIntervals, setAccumulatedPathIntervals] = useState<
    Record<string, Immutable<PlotData>>
  >({});

  useEffect(() => {
    if (!isEmpty(currentFrameData.data.datasetsByPath)) {
      setAccumulatedPathIntervals((oldValue) => ({
        ...oldValue,
        [currentFrameData.tag]: currentFrameData.data,
      }));
    }
  }, [currentFrameData.data, currentFrameData.tag]);

  // Trim currentFrame data outside allFrames, assuming allFrames is contiguous from start
  // time.
  const trimmedCurrentFrameData = useMemo(() => {
    return filterMap(Object.values(accumulatedPathIntervals), (dataset) => {
      const trimmedDatasets = maps.mapValues(dataset.datasetsByPath, (ds, path) => {
        const topic = parseRosPath(path.value)?.topicName;
        const end = topic ? allFrames[topic]?.at(-1)?.receiveTime : undefined;
        if (end) {
          return {
            ...ds,
            data: ds.data.filter((datum) => isGreaterThan(datum.receiveTime, end)),
          };
        } else {
          return ds;
        }
      });

      if ([...trimmedDatasets.values()].some((ds) => ds.data.length > 0)) {
        return { ...dataset, datasetsByPath: trimmedDatasets };
      } else {
        return undefined;
      }
    });
  }, [accumulatedPathIntervals, allFrames]);

  // Combine allFrames & currentFrames datasets, optionally applying the @derivative
  // modifier and sorting by header stamp, which can only be calculated on a complete
  // dataset, not point by point.
  const allData = useMemo(() => {
    const combinedPlotData = reducePlotData([state.data, ...trimmedCurrentFrameData]);
    const dataAfterDerivative = applyDerivativeToPlotData(combinedPlotData);
    const sortedData = sortPlotDataByHeaderStamp(dataAfterDerivative);

    return {
      bounds: sortedData.bounds,
      // Return a dataset for all paths here so that the ordering of datasets corresponds
      // to yAxisPaths as expected by downstream components like the legend.
      //
      // Label is needed so that TimeBasedChart doesn't discard the empty dataset and mess
      // up the ordering.
      datasets: yAxisPaths.map(
        (path) =>
          sortedData.datasetsByPath.get(path) ?? { label: path.label ?? path.value, data: [] },
      ),
      pathsWithMismatchedDataLengths: sortedData.pathsWithMismatchedDataLengths,
    };
  }, [state.data, trimmedCurrentFrameData, yAxisPaths]);

  return allData;
}
