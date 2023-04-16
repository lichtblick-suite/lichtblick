// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { groupBy, isEmpty, pick } from "lodash";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isLessThan, isTimeInRangeInclusive, subtract } from "@foxglove/rostime";
import { useBlocksByTopic, useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import parseRosPath, {
  getTopicsFromPaths,
} from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  useCachedGetMessagePathDataItems,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDefaultView } from "@foxglove/studio-base/components/TimeBasedChart";
import { PlotDataByPath } from "@foxglove/studio-base/panels/Plot/internalTypes";
import * as PlotData from "@foxglove/studio-base/panels/Plot/plotData";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

type TaggedPlotDataByPath = { tag: string; data: PlotDataByPath };

type Params = Immutable<{
  allPaths: string[];
  followingView: undefined | ChartDefaultView;
  showSingleCurrentMessage: boolean;
}>;

/**
 * Combines preloaded block data and messages accumulated during playback into a
 * single PlotDataByPath object.
 */
export function usePlotPanelMessageData(params: Params): Immutable<PlotDataByPath> {
  const { allPaths, followingView, showSingleCurrentMessage } = params;

  // When iterating message events, we need a reverse lookup from topic to the
  // paths that requested the topic.
  const topicToPaths = useMemo(
    () => groupBy(allPaths, (path) => parseRosPath(path)?.topicName),
    [allPaths],
  );

  const subscribeTopics = useMemo(() => getTopicsFromPaths(allPaths), [allPaths]);

  const blocks = useBlocksByTopic(subscribeTopics);

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(allPaths);

  // This memoization isn't quite ideal: getDatasets is a bit expensive with
  // lots of preloaded data, and when we preload a new block we re-generate the
  // datasets for the whole timeline. We could try to use block memoization
  // here.
  const plotDataForBlocks = useMemo(() => {
    if (showSingleCurrentMessage) {
      return {};
    }
    return PlotData.getBlockItemsByPath(decodeMessagePathsForMessagesByTopic, blocks);
  }, [blocks, decodeMessagePathsForMessagesByTopic, showSingleCurrentMessage]);

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(allPaths);

  const blocksTimeRange = useMemo(
    () => PlotData.findTimeRanges(plotDataForBlocks),
    [plotDataForBlocks],
  );

  // When restoring, keep only the paths that are present in allPaths. Without
  // this, the reducer value will grow unbounded with new paths as users
  // add/remove series. We use a timestamp tag so we can accumulate messages
  // across multiple restore calls.
  const restore = useCallback(
    (previous?: TaggedPlotDataByPath): TaggedPlotDataByPath => {
      if (!previous) {
        return { tag: new Date().toISOString(), data: {} };
      }

      return { ...previous, data: pick(previous.data, allPaths) };
    },
    [allPaths],
  );

  const addMessages = useCallback(
    (accumulated: TaggedPlotDataByPath, msgEvents: readonly MessageEvent<unknown>[]) => {
      const lastEventTime = msgEvents[msgEvents.length - 1]?.receiveTime;
      const isFollowing = followingView?.type === "following";

      // If we don't change any accumulated data, avoid returning a new "accumulated" object so
      // react hooks remain stable.
      let newAccumulated: TaggedPlotDataByPath | undefined;

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
          const existingBlockRange = blocksTimeRange.byPath[path];
          if (
            existingBlockRange &&
            isTimeInRangeInclusive(
              msgEvent.receiveTime,
              existingBlockRange.start,
              existingBlockRange.end,
            )
          ) {
            // Skip messages that fall within the range of our block data since
            // we would just filter them out later anyway. Note that this
            // assumes blocks are loaded contiguously starting from the
            // beginning of message data.
            continue;
          }
          const plotDataItem = {
            queriedData: dataItem,
            receiveTime: msgEvent.receiveTime,
            headerStamp,
          };

          newAccumulated ??= { ...accumulated };

          if (showSingleCurrentMessage) {
            newAccumulated.data[path] = [[plotDataItem]];
          } else {
            const plotDataPath = newAccumulated.data[path]?.slice() ?? [[]];
            // PlotDataPaths have 2d arrays of items to accommodate blocks which
            // may have gaps so each continuous set of blocks forms one
            // continuous line. For streaming messages we treat this as one
            // continuous set of items and always add to the first "range"
            const plotDataItems = plotDataPath[0]!;

            // If we are using the _following_ view mode, truncate away any
            // items older than the view window.
            if (lastEventTime && isFollowing) {
              const minStamp = subtract(lastEventTime, { sec: followingView.width, nsec: 0 });
              const newItems = plotDataItems.filter(
                (item) => !isLessThan(item.receiveTime, minStamp),
              );
              newItems.push(plotDataItem);
              plotDataPath[0] = newItems;
            } else {
              plotDataPath[0] = plotDataItems.concat(plotDataItem);
            }

            newAccumulated.data[path] = plotDataPath;
          }
        }
      }

      return newAccumulated ?? accumulated;
    },
    [
      blocksTimeRange,
      cachedGetMessagePathDataItems,
      followingView,
      showSingleCurrentMessage,
      topicToPaths,
    ],
  );

  const plotDataByPath = useMessageReducer<TaggedPlotDataByPath>({
    topics: subscribeTopics,
    preloadType: "full",
    restore,
    addMessages,
  });

  // Accumulate separate message playback sequences into distinct intervals we
  // can later combine into a single combined set of message data.
  const [accumulatedPathIntervals, setAccumulatedPathIntervals] = useState<
    Record<string, PlotDataByPath>
  >({});

  useEffect(() => {
    if (!isEmpty(plotDataByPath.data)) {
      setAccumulatedPathIntervals((oldValue) => ({
        ...oldValue,
        [plotDataByPath.tag]: plotDataByPath.data,
      }));
    }
  }, [plotDataByPath, plotDataForBlocks]);

  const combinedPlotData = useMemo(
    () => PlotData.combine([plotDataForBlocks, ...Object.values(accumulatedPathIntervals)]),
    [accumulatedPathIntervals, plotDataForBlocks],
  );

  return combinedPlotData;
}
