// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { groupBy, intersection, isEmpty, transform, union, zipWith } from "lodash";
import { useCallback, useMemo, useState } from "react";
import { useLatest } from "react-use";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import { isLessThan, subtract } from "@foxglove/rostime";
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
import {
  BasePlotPath,
  DataSet,
  PlotDataByPath,
  PlotPath,
  PlotXAxisVal,
} from "@foxglove/studio-base/panels/Plot/internalTypes";
import * as PlotData from "@foxglove/studio-base/panels/Plot/plotData";
import { derivative } from "@foxglove/studio-base/panels/Plot/transformPlotRange";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { Bounds, makeInvertedBounds, unionBounds } from "@foxglove/studio-base/types/Bounds";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import { DataSets, getDatasets, mergeDatasets } from "./datasets";
import { useFlattenedBlocksByTopic } from "./useFlattenedBlocksByTopic";

const ZERO_TIME = { sec: 0, nsec: 0 };

const EmptyAllFrames: Record<string, MessageEvent[]> = {};

const EmptyDatasets: DataSets = {
  datasets: [],
  bounds: makeInvertedBounds(),
  pathsWithMismatchedDataLengths: [],
};

type Params = Immutable<{
  allPaths: string[];
  followingView: undefined | ChartDefaultView;
  showSingleCurrentMessage: boolean;
  startTime: undefined | Time;
  xAxisVal: PlotXAxisVal;
  xAxisPath?: BasePlotPath;
  yAxisPaths: PlotPath[];
}>;

type State = DataSets & {
  allFrames: Record<string, Immutable<MessageEvent[]>>;
  allPaths: readonly string[];
  bounds: Bounds;
  cursors: Record<string, number>;
  subscriptions: Subscription[];
  xAxisVal: PlotXAxisVal;
  xAxisPath: undefined | BasePlotPath;
};

/**
 * Applies the @derivative modifier to the dataset. This has to be done on the complete
 * dataset, not calculated incrementally.
 */
function applyDerivativeToDatasets(datasets: DataSets["datasets"]): DataSets["datasets"] {
  return datasets.map((dataset) => {
    if (dataset == undefined) {
      return undefined;
    }

    if (dataset.path.value.endsWith(".@derivative")) {
      return {
        path: dataset.path,
        dataset: { ...dataset.dataset, data: derivative(dataset.dataset.data) },
      };
    } else {
      return dataset;
    }
  });
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
function sortDatasetsByHeaderStamp(datasets: DataSets["datasets"]): DataSets["datasets"] {
  return datasets.map((dataset) => {
    if (dataset == undefined) {
      return undefined;
    }

    if (dataset.path.timestampMethod !== "headerStamp") {
      return dataset;
    }

    return {
      path: dataset.path,
      dataset: { ...dataset.dataset, data: dataset.dataset.data.sort((a, b) => a.x - b.x) },
    };
  });
}

function makeInitialState(): State {
  return {
    allFrames: {},
    allPaths: [],
    bounds: makeInvertedBounds(),
    cursors: {},
    datasets: [],
    subscriptions: [],
    pathsWithMismatchedDataLengths: [],
    xAxisVal: "timestamp",
    xAxisPath: undefined,
  };
}

/**
 * Collates and combines datasets from alLFrames and currentFrame messages.
 */
export function usePlotPanelDatasets(params: Params): {
  bounds: Bounds;
  datasets: DataSet[];
  pathsWithMismatchedDataLengths: string[];
} {
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

  const allFramesFromBlocks = useFlattenedBlocksByTopic(subscribeTopics);

  const allFrames = showSingleCurrentMessage ? EmptyAllFrames : allFramesFromBlocks;

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(allPaths);

  const resetDatasets =
    allPaths !== state.allPaths || xAxisVal !== state.xAxisVal || xAxisPath !== state.xAxisPath;

  if (allFrames !== state.allFrames || resetDatasets) {
    // use setState directly instead of useEffect to skip an extra render.
    setState((oldState) => {
      const newState = resetDatasets ? makeInitialState() : oldState;

      const newFramesByTopic = transform(
        allFrames,
        (acc, messages, topic) => {
          acc[topic] = messages.slice(newState.cursors[topic] ?? 0);
        },
        {} as State["allFrames"],
      );

      const newCursors = transform(
        allFrames,
        (acc, messages, topic) => {
          acc[topic] = messages.length;
        },
        {} as State["cursors"],
      );

      const newBlockItems = PlotData.getBlockItemsByPath(
        decodeMessagePathsForMessagesByTopic,
        newFramesByTopic,
      );

      const anyNewFrames = Object.values(newFramesByTopic).some((msgs) => msgs.length > 0);

      const newDatasets = anyNewFrames
        ? getDatasets({
            paths: yAxisPaths,
            itemsByPath: newBlockItems,
            startTime: startTime ?? ZERO_TIME,
            xAxisVal,
            xAxisPath,
            invertedTheme: theme.palette.mode === "dark",
          })
        : EmptyDatasets;

      const mergedDatasets: State["datasets"] = zipWith(
        newState.datasets,
        newDatasets.datasets,
        mergeDatasets,
      );

      return {
        allFrames,
        allPaths,
        bounds: unionBounds(newState.bounds, newDatasets.bounds),
        cursors: newCursors,
        datasets: mergedDatasets,
        pathsWithMismatchedDataLengths: union(
          newState.pathsWithMismatchedDataLengths,
          newDatasets.pathsWithMismatchedDataLengths,
        ),
        subscriptions,
        xAxisPath,
        xAxisVal,
      };
    });
  }

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(allPaths);

  // When restoring, keep only the paths that are present in allPaths. Without this, the
  // reducer value will grow unbounded with new paths as users add/remove series.
  const restore = useCallback(
    (previous?: DataSets): DataSets => {
      if (previous) {
        return {
          datasets: previous.datasets.filter((ds) => ds && allPaths.includes(ds.path.value)),
          bounds: previous.bounds,
          pathsWithMismatchedDataLengths: intersection(
            previous.pathsWithMismatchedDataLengths,
            allPaths,
          ),
        };
      } else {
        return {
          datasets: [],
          bounds: makeInvertedBounds(),
          pathsWithMismatchedDataLengths: [],
        };
      }
    },
    [allPaths],
  );

  const latestAllFramesDatasets = useLatest(state.datasets);

  const addMessages = useCallback(
    (accumulated: DataSets, msgEvents: Immutable<MessageEvent[]>) => {
      const lastEventTime = msgEvents.at(-1)?.receiveTime;
      const isFollowing = followingView?.type === "following";
      const newMessages: PlotDataByPath = {};

      for (const msgEvent of msgEvents) {
        const paths = topicToPaths[msgEvent.topic];
        if (!paths) {
          continue;
        }

        for (const [pathIndex, path] of paths.entries()) {
          // Skip datasets we're getting from allFrames.
          if ((latestAllFramesDatasets.current[pathIndex]?.dataset.data.length ?? 0) > 0) {
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

      const newDatasets = getDatasets({
        paths: yAxisPaths,
        itemsByPath: newMessages,
        startTime: startTime ?? ZERO_TIME,
        xAxisVal,
        xAxisPath,
        invertedTheme: theme.palette.mode === "dark",
      });

      const mergedDatasets: DataSets = {
        bounds: unionBounds(accumulated.bounds, newDatasets.bounds),
        // If showing a single current message replace instead of concatenating datasets.
        datasets: showSingleCurrentMessage
          ? newDatasets.datasets
          : zipWith(accumulated.datasets, newDatasets.datasets, mergeDatasets),
        pathsWithMismatchedDataLengths: union(
          accumulated.pathsWithMismatchedDataLengths,
          newDatasets.pathsWithMismatchedDataLengths,
        ),
      };

      return mergedDatasets;
    },
    [
      cachedGetMessagePathDataItems,
      followingView,
      latestAllFramesDatasets,
      showSingleCurrentMessage,
      startTime,
      theme.palette.mode,
      topicToPaths,
      xAxisPath,
      xAxisVal,
      yAxisPaths,
    ],
  );

  const currentFrameDatasets = useMessageReducer<DataSets>({
    topics: subscribeTopics,
    preloadType: "full",
    restore,
    addMessages,
  });

  // Combine allFrames & currentFrames datasets, optionally applying the @derivative
  // modifier and sorting by header stamp, which can only be calculated on a complete
  // dataset, not point by point.
  const combinedDatasets = useMemo(() => {
    const stateWithDerivatives = applyDerivativeToDatasets(state.datasets);
    const sortedStateWithDerivatives = sortDatasetsByHeaderStamp(stateWithDerivatives);
    const currentFrameWithDerivatives = applyDerivativeToDatasets(currentFrameDatasets.datasets);
    const sortedCurrentFrameWithDerivatives = sortDatasetsByHeaderStamp(
      currentFrameWithDerivatives,
    );
    const allDatasets = Object.values(sortedStateWithDerivatives).concat(
      Object.values(sortedCurrentFrameWithDerivatives),
    );
    const bounds = unionBounds(state.bounds, currentFrameDatasets.bounds);
    return {
      bounds,
      datasets: filterMap(allDatasets, (ds) => (ds ? ds.dataset : undefined)),
      pathsWithMismatchedDataLengths: union(
        state.pathsWithMismatchedDataLengths,
        currentFrameDatasets.pathsWithMismatchedDataLengths,
      ),
    };
  }, [
    currentFrameDatasets.bounds,
    currentFrameDatasets.datasets,
    currentFrameDatasets.pathsWithMismatchedDataLengths,
    state.bounds,
    state.datasets,
    state.pathsWithMismatchedDataLengths,
  ]);

  return combinedDatasets;
}
