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

import { groupBy } from "lodash";
import { useCallback } from "react";

import { useDeepMemo } from "@foxglove/hooks";
import { MessageEvent, SubscribePayload } from "@foxglove/studio-base/players/types";
import concatAndTruncate from "@foxglove/studio-base/util/concatAndTruncate";

import { useMessageReducer } from "./useMessageReducer";

// Topic types that are not known at compile time
type UnknownMessageEventsByTopic = Record<string, readonly MessageEvent[]>;

/**
 * useMessagesByTopic makes it easy to request some messages on some topics.
 *
 * Using this hook will cause the panel to re-render when new messages arrive on the requested topics.
 * - During file playback the panel will re-render when the file is playing or when the user is scrubbing.
 * - During live playback the panel will re-render when new messages arrive.
 */
export function useMessagesByTopic(params: {
  topics: readonly string[] | SubscribePayload[];
  historySize: number;
}): Record<string, readonly MessageEvent[]> {
  const { historySize, topics } = params;
  const requestedTopics = useDeepMemo(topics);

  const addMessages = useCallback(
    (prevMessagesByTopic: UnknownMessageEventsByTopic, messages: readonly MessageEvent[]) => {
      const newMessagesByTopic = groupBy(messages, "topic");
      const ret: UnknownMessageEventsByTopic = { ...prevMessagesByTopic };
      Object.entries(newMessagesByTopic).forEach(([topic, newMessages]) => {
        const retTopic = ret[topic];
        if (retTopic) {
          ret[topic] = concatAndTruncate(retTopic, newMessages, historySize);
        }
      });
      return ret;
    },
    [historySize],
  );

  const restore = useCallback(
    (prevMessagesByTopic?: UnknownMessageEventsByTopic) => {
      const newMessagesByTopic: UnknownMessageEventsByTopic = {};
      // When changing topics, we try to keep as many messages around from the previous set of
      // topics as possible.
      for (const topic of requestedTopics) {
        const topicName = typeof topic === "string" ? topic : topic.topic;
        const prevMessages = prevMessagesByTopic?.[topicName];
        newMessagesByTopic[topicName] = prevMessages?.slice(-historySize) ?? [];
      }
      return newMessagesByTopic;
    },
    [requestedTopics, historySize],
  );

  return useMessageReducer({
    topics: requestedTopics,
    restore,
    addMessages,
  });
}
