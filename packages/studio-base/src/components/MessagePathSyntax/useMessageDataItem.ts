// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useCallback, useMemo } from "react";

import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { subscribePayloadFromMessagePath } from "@foxglove/studio-base/players/subscribePayloadFromMessagePath";
import { MessageEvent, SubscribePayload } from "@foxglove/studio-base/players/types";

import {
  MessageAndData,
  useCachedGetMessagePathDataItems,
} from "./useCachedGetMessagePathDataItems";

type Options = {
  historySize: number;
};

type ReducedValue = {
  // Matched message (events) oldest message first
  matches: MessageAndData[];

  // The latest set of message events recevied to addMessages
  messageEvents: readonly Readonly<MessageEvent>[];

  // The path used to match these messages.
  path: string;
};

/**
 * Return an array of MessageAndData[] for matching messages on @param path.
 *
 * The first array item is the oldest matched message, and the last item is the newest.
 *
 * The `historySize` option configures how many matching messages to keep. The default is 1.
 */
export function useMessageDataItem(path: string, options?: Options): ReducedValue["matches"] {
  const { historySize = 1 } = options ?? {};
  const topics: SubscribePayload[] = useMemo(() => {
    const payload = subscribePayloadFromMessagePath(path, "partial");
    if (payload) {
      return [payload];
    }
    return [];
  }, [path]);

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems([path]);

  const addMessages = useCallback(
    (prevValue: ReducedValue, messageEvents: Readonly<MessageEvent[]>): ReducedValue => {
      if (messageEvents.length === 0) {
        return prevValue;
      }

      const newMatches: MessageAndData[] = [];

      // Iterate backwards since our default history size is 1 and we might not need to visit all messages
      // This does mean we need to flip newMatches around since we want to store older items first
      for (let i = messageEvents.length - 1; i >= 0 && newMatches.length < historySize; --i) {
        const messageEvent = messageEvents[i]!;
        const queriedData = cachedGetMessagePathDataItems(path, messageEvent);
        if (queriedData && queriedData.length > 0) {
          newMatches.push({ messageEvent, queriedData });
        }
      }

      // We want older items to be first in the array. Since we iterated backwards
      // we reverse the matches.
      const reversed = newMatches.reverse();
      if (newMatches.length === historySize) {
        return {
          matches: reversed,
          messageEvents,
          path,
        };
      }

      const prevMatches = prevValue.matches;
      return {
        matches: prevMatches.concat(reversed).slice(-historySize),
        messageEvents,
        path,
      };
    },
    [cachedGetMessagePathDataItems, historySize, path],
  );

  const restore = useCallback(
    (prevValue?: ReducedValue): ReducedValue => {
      if (!prevValue) {
        return {
          matches: [],
          messageEvents: [],
          path,
        };
      }

      // re-filter the previous batch of messages
      const newMatches: MessageAndData[] = [];
      for (const messageEvent of prevValue.messageEvents) {
        const queriedData = cachedGetMessagePathDataItems(path, messageEvent);
        if (queriedData && queriedData.length > 0) {
          newMatches.push({ messageEvent, queriedData });
        }
      }

      // Return a new message set if we have matching messages or this is a different path
      // than the path used to fetch the previous set of messages.
      if (newMatches.length > 0 || path !== prevValue.path) {
        return {
          matches: newMatches.slice(-historySize),
          messageEvents: prevValue.messageEvents,
          path,
        };
      }

      return prevValue;
    },
    [cachedGetMessagePathDataItems, historySize, path],
  );

  const reducedValue = useMessageReducer<ReducedValue>({
    topics,
    addMessages,
    restore,
  });

  return reducedValue.matches;
}
