// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { groupBy, intersection, isEmpty } from "lodash";
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
import { useCachedGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDefaultView } from "@foxglove/studio-base/components/TimeBasedChart";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { derivative } from "@foxglove/studio-base/panels/Plot/transformPlotRange";
import { useStableValidPathsForDatasourceTopics } from "@foxglove/studio-base/panels/Plot/useStableValidPathsForDatasourceTopics";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { Bounds, makeInvertedBounds, unionBounds } from "@foxglove/studio-base/types/Bounds";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import { calculateDatasetBounds } from "./datasets";
import { BasePlotPath, DataSet, PlotDataItem, PlotPath, PlotXAxisVal } from "./internalTypes";
import * as maps from "./maps";
import {
  EmptyPlotData,
  PlotData,
  appendPlotData,
  buildPlotData,
  messageAndDataToPathItem,
  reducePlotData,
} from "./plotData";
import { useAllFramesByTopic } from "./useAllFramesByTopic";

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });

const EmptyAllFrames: Immutable<Record<string, MessageEvent[]>> = Object.freeze({});

const EMPTY_ARR = Object.freeze(new Array<PlotData>());

type TaggedPlotData = { tag: string; data: Immutable<PlotData> };

type Params = Immutable<{
  followingView: undefined | ChartDefaultView;
  showSingleCurrentMessage: boolean;
  startTime: undefined | Time;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  yAxisPaths: PlotPath[];
}>;

type State = Immutable<{
  allFrames: Record<string, Immutable<MessageEvent[]>>;
  allPaths: PlotPath[];
  cursors: Map<PlotPath, number>;
  data: PlotData;
  globalVariables: GlobalVariables;
  subscriptions: Subscription[];
  xAxisVal: PlotXAxisVal;
  xAxisPath: undefined | PlotPath;
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
    cursors: new Map(),
    data: EmptyPlotData,
    globalVariables: {},
    subscriptions: [],
    xAxisVal: "timestamp",
    xAxisPath: undefined,
  };
}

/**
 * Collates and combines data from alLFrames and currentFrame messages.
 *
 * Note that this expects xAxisPath & yAxisPaths to be referentially stable if their properties
 * haven't changed.
 */
export function usePlotPanelData(params: Params): Immutable<{
  bounds: Bounds;
  datasets: DataSet[];
  pathsWithMismatchedDataLengths: string[];
}> {
  const { followingView, showSingleCurrentMessage, startTime, xAxisPath, xAxisVal, yAxisPaths } =
    params;

  // Because we have to track our new message cursors separately for each path we have to index
  // into our accumulated messages by the exact path object. This means the xAxis path has to be
  // representable as another PlotPath.
  const xAxisPathAsFullPlotPath: undefined | PlotPath = useMemo(
    () => (xAxisPath ? { ...xAxisPath, timestampMethod: "receiveTime" } : undefined),
    [xAxisPath],
  );

  const allPaths = useMemo(
    () => (xAxisPathAsFullPlotPath ? [...yAxisPaths, xAxisPathAsFullPlotPath] : yAxisPaths),
    [xAxisPathAsFullPlotPath, yAxisPaths],
  );

  // Filter allPaths down to paths that parse as a valid path and point to a topic that exists in
  // our datasource to prevent a lot of wasted work while the user is inteeractively editing paths.
  const validAllPaths = useStableValidPathsForDatasourceTopics(allPaths);
  const validYAxisPaths = useShallowMemo(
    yAxisPaths.filter((path) => validAllPaths.some((vp) => path.value === vp.value)),
  );

  const validAllPathValues = useMemo(
    () => validAllPaths.map((path) => path.value),
    [validAllPaths],
  );

  const subscribeTopics = useMemo(
    () => getTopicsFromPaths(validAllPathValues),
    [validAllPathValues],
  );

  const theme = useTheme();

  // When iterating message events, we need a reverse lookup from topic to the
  // paths that requested the topic.
  const topicToPaths = useMemo(
    () => groupBy(validAllPaths, (path) => parseRosPath(path.value)?.topicName),
    [validAllPaths],
  );

  const subscriptions: Subscription[] = useMemo(() => {
    return subscribeTopics.map((topic) => ({ topic, preload: true }));
  }, [subscribeTopics]);

  const [state, setState] = useState(makeInitialState);

  const allFramesByTopic = useAllFramesByTopic(subscribeTopics);

  const allFrames = showSingleCurrentMessage ? EmptyAllFrames : allFramesByTopic;

  const messageDataPathGetter = useCachedGetMessagePathDataItems(validAllPathValues);

  const { globalVariables } = useGlobalVariables();

  // Resets all data when global variables change. This could be more fine grained and parse the
  // paths to only rebuild when variables change that are referenced in plot paths.
  const resetDatasets =
    xAxisVal !== state.xAxisVal ||
    xAxisPathAsFullPlotPath !== state.xAxisPath ||
    globalVariables !== state.globalVariables;

  if (allFrames !== state.allFrames || validAllPaths !== state.allPaths || resetDatasets) {
    // Derive a new state based on the old state & new message data. Note that we maintain a
    // separate cursor into allFrames for each path. This is necessary because newly added series
    // might have the same path as previous series but will need to process all messages not from
    // the beginning instead of reusing the cursor from the previous series with the same path.
    //
    // We try here to provide a minimal update for downstream referential integrity purposes. Paths
    // that recieve no new messages should be represented unchanged in the new state.
    //
    // Uses setState directly instead of useEffect to skip an extra render.
    setState((oldState) => {
      const newState = resetDatasets ? makeInitialState() : oldState;
      const newDataItems: Map<PlotPath, PlotDataItem[]> = new Map();
      const newCursors: Map<PlotPath, number> = new Map();
      let haveNewMessages = false;
      for (const path of validAllPaths) {
        newCursors.set(path, newState.cursors.get(path) ?? 0);

        const topic = parseRosPath(path.value)?.topicName;
        if (topic == undefined) {
          continue;
        }

        const newMessages = allFramesByTopic[topic]?.slice(newCursors.get(path) ?? 0);
        if (newMessages == undefined || newMessages.length === 0) {
          continue;
        }

        newCursors.set(path, (newCursors.get(path) ?? 0) + newMessages.length);

        const dataItems: PlotDataItem[] = filterMap(newMessages, (msg) => {
          const queriedData = messageDataPathGetter(path.value, msg);

          return queriedData && queriedData.length > 0
            ? messageAndDataToPathItem({ queriedData, messageEvent: msg })
            : undefined;
        });

        if (dataItems.length > 0) {
          haveNewMessages = true;
          newDataItems.set(path, dataItems);
        }
      }

      const newPlotData = haveNewMessages
        ? buildPlotData({
            paths: validYAxisPaths,
            itemsByPath: newDataItems,
            startTime: startTime ?? ZERO_TIME,
            xAxisVal,
            xAxisPath: xAxisPathAsFullPlotPath,
            invertedTheme: theme.palette.mode === "dark",
          })
        : EmptyPlotData;

      return {
        allFrames,
        allPaths: validAllPaths,
        cursors: newCursors,
        data: appendPlotData(newState.data, newPlotData),
        globalVariables,
        subscriptions,
        xAxisPath: xAxisPathAsFullPlotPath,
        xAxisVal,
      };
    });
  }

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(validAllPathValues);

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
      const newYPathValues = validYAxisPaths.map((path) => path.value);
      const retainedDataSets = maps.pick(previous.data.datasetsByPath, validYAxisPaths);
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
    [showSingleCurrentMessage, validYAxisPaths],
  );

  // Access allFrames by reference to avoid invalidating the addMessages callback.
  const latestAllFrames = useLatest(allFrames);

  const addMessages = useCallback(
    (accumulated: TaggedPlotData, msgEvents: Immutable<MessageEvent[]>) => {
      const lastEventTime = msgEvents.at(-1)?.receiveTime;
      const isFollowing = followingView?.type === "following";
      const newMessages: Map<PlotPath, PlotDataItem[]> = new Map();

      for (const msgEvent of msgEvents) {
        const paths = topicToPaths[msgEvent.topic];
        if (!paths) {
          continue;
        }

        for (const path of paths) {
          const dataItem = cachedGetMessagePathDataItems(path.value, msgEvent);
          if (!dataItem) {
            continue;
          }

          const headerStamp = getTimestampForMessage(msgEvent.message);

          const allFramesForPathStart = latestAllFrames.current[path.value]?.at(0)?.receiveTime;
          const allFramesForPathEnd = latestAllFrames.current[path.value]?.at(-1)?.receiveTime;
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
            newMessages.set(path, [plotDataItem]);
          } else {
            let plotDataPath = newMessages.get(path)?.slice() ?? [];
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

            newMessages.set(path, plotDataPath);
          }
        }
      }

      if (isEmpty(newMessages)) {
        return accumulated;
      }

      const newPlotData = buildPlotData({
        paths: validYAxisPaths,
        itemsByPath: newMessages,
        startTime: startTime ?? ZERO_TIME,
        xAxisVal,
        xAxisPath: xAxisPathAsFullPlotPath,
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
      followingView,
      validYAxisPaths,
      startTime,
      xAxisVal,
      xAxisPathAsFullPlotPath,
      theme.palette.mode,
      showSingleCurrentMessage,
      topicToPaths,
      cachedGetMessagePathDataItems,
      latestAllFrames,
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
    const trimmed = filterMap(Object.values(accumulatedPathIntervals), (dataset) => {
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

    // If all data is trimmed then return a stable empty array so we don't rebuild allData below
    if (trimmed.length === 0) {
      return EMPTY_ARR;
    }

    return trimmed;
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
      datasets: validYAxisPaths.map(
        (path) =>
          sortedData.datasetsByPath.get(path) ?? { label: path.label ?? path.value, data: [] },
      ),
      pathsWithMismatchedDataLengths: sortedData.pathsWithMismatchedDataLengths,
    };
  }, [state.data, trimmedCurrentFrameData, validYAxisPaths]);

  return allData;
}
