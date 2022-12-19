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

import memoizeWeak from "memoize-weak";
import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";
import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove/studio-base/components/MessagePipeline";
import {
  SubscribePayload,
  MessageEvent,
  MessageBlock as PlayerMessageBlock,
} from "@foxglove/studio-base/players/types";

export type MessageBlock = {
  readonly [topicName: string]: readonly MessageEvent<unknown>[];
};

// Memoization probably won't speed up the filtering appreciably, but preserves return identity.
// That said, MessageBlock identity will change when the set of topics changes, so consumers should
// prefer to use the identity of topic-block message arrays where possible.
const filterBlockByTopics = memoizeWeak(
  (block: PlayerMessageBlock | undefined, topics: readonly string[]): MessageBlock => {
    if (!block) {
      // For our purposes, a missing MemoryCacheBlock just means "no topics have been cached for
      // this block". This is semantically different to an empty array per topic, but not different
      // to a MemoryCacheBlock with no per-topic arrays.
      return {};
    }
    const ret: Record<string, readonly MessageEvent<unknown>[]> = {};
    for (const topic of topics) {
      // Don't include an empty array when the data has not been cached for this topic for this
      // block. The missing entry means "we don't know the message for this topic in this block", as
      // opposed to "we know there are no messages for this topic in this block".
      const blockMessages = block.messagesByTopic[topic];
      if (blockMessages) {
        ret[topic] = blockMessages;
      }
    }
    return ret;
  },
);

const useSubscribeToTopicsForBlocks = (topics: readonly string[]) => {
  const [id] = useState(() => uuidv4());

  const setSubscriptions = useMessagePipeline(
    useCallback(
      ({ setSubscriptions: pipelineSetSubscriptions }: MessagePipelineContext) =>
        pipelineSetSubscriptions,
      [],
    ),
  );
  const subscriptions: SubscribePayload[] = useMemo(() => {
    return topics.map((topic) => ({ topic, preloadType: "full" }));
  }, [topics]);
  useEffect(() => setSubscriptions(id, subscriptions), [id, setSubscriptions, subscriptions]);

  useEffect(() => {
    return () => {
      setSubscriptions(id, []);
    };
  }, [id, setSubscriptions]);
};

// A note: for the moment,
//  - not all players provide blocks, and
//  - topics for nodes are not available in blocks when blocks _are_ provided,
// so all consumers need a "regular playback" pipeline fallback for now.
//
// Semantics of blocks:
//   - Missing topics have not been cached.
//   - Adjacent elements are contiguous
//   - Each block represents the same duration of time
//   - The number of blocks is consistent for the data source
//   - Blocks are stored in increasing order of time
export function useBlocksByTopic(topics: readonly string[]): readonly MessageBlock[] {
  const requestedTopics = useShallowMemo(topics);

  useSubscribeToTopicsForBlocks(requestedTopics);

  const allBlocks = useMessagePipeline<readonly (PlayerMessageBlock | undefined)[] | undefined>(
    useCallback((ctx) => ctx.playerState.progress.messageCache?.blocks, []),
  );

  const blocks = useMemo(() => {
    if (!allBlocks) {
      return [];
    }
    return allBlocks.map((block) => filterBlockByTopics(block, requestedTopics));
  }, [allBlocks, requestedTopics]);

  return blocks;
}
