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
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MessageReader } from "rosbag";
import { v4 as uuidv4 } from "uuid";

import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove-studio/app/components/MessagePipeline";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import { MemoryCacheBlock } from "@foxglove-studio/app/dataProviders/MemoryCacheDataProvider";
import ParsedMessageCache from "@foxglove-studio/app/dataProviders/ParsedMessageCache";
import useCleanup from "@foxglove-studio/app/hooks/useCleanup";
import useShallowMemo from "@foxglove-studio/app/hooks/useShallowMemo";
import {
  BobjectMessage,
  SubscribePayload,
  TypedMessage,
  PlayerState,
} from "@foxglove-studio/app/players/types";

// Preloading users can (optionally) share this cache of recently parsed messages if they think
// other panels might use data on the same topic.
export const blockMessageCache = new ParsedMessageCache();

// This is a fairly low-level API -- parsing eagerly and caching the result is not sustainable, but
// anyone who asks for binary data probably wants to parse it and cache it somehow, so give the
// user a parser and the messages in a block-format useful for caching.

type MessageBlock = {
  readonly [topicName: string]: readonly TypedMessage<ArrayBuffer>[];
};

type BlocksForTopics = {
  // TODO(jp/steel): Figure out whether it's better to return message definitions here. It's
  // possible consumers will want to pass the readers through worker boundaries.
  messageReadersByTopic: {
    [topicName: string]: MessageReader;
  };
  // Semantics of blocks: Missing topics have not been cached. Adjacent elements are contiguous
  // in time. Corresponding indexes in different BlocksForTopics cover the same time-range. Blocks
  // are stored in increasing order of time.
  blocks: readonly MessageBlock[];
};

// Memoization probably won't speed up the filtering appreciably, but preserves return identity.
// That said, MessageBlock identity will change when the set of topics changes, so consumers should
// prefer to use the identity of topic-block message arrays where possible.
const filterBlockByTopics = memoizeWeak(
  (block: MemoryCacheBlock | undefined, topics: readonly string[]): MessageBlock => {
    if (!block) {
      // For our purposes, a missing MemoryCacheBlock just means "no topics have been cached for
      // this block". This is semantically different to an empty array per topic, but not different
      // to a MemoryCacheBlock with no per-topic arrays.
      return {};
    }
    const ret: Record<string, readonly BobjectMessage[]> = {};
    for (const topic of topics) {
      // Don't include an empty array when the data has not been cached for this topic for this
      // block. The missing entry means "we don't know the message for this topic in this block", as
      // opposed to "we know there are no messages for this topic in this block".
      const maybeBobjectMessage = block.messagesByTopic[topic];
      if (maybeBobjectMessage) {
        ret[topic] = maybeBobjectMessage;
      }
    }
    return ret;
  },
);

const useSubscribeToTopicsForBlocks = (topics: readonly string[]) => {
  const [id] = useState(() => uuidv4());
  const { type: panelType = undefined } = useContext(PanelContext) || {};

  const setSubscriptions = useMessagePipeline(
    useCallback(
      ({ setSubscriptions: pipelineSetSubscriptions }: MessagePipelineContext) =>
        pipelineSetSubscriptions,
      [],
    ),
  );
  const subscriptions: SubscribePayload[] = useMemo(() => {
    const requester = panelType ? { type: "panel", name: panelType } : undefined;
    return topics.map((topic) => <SubscribePayload>{ topic, requester, format: "bobjects" });
  }, [panelType, topics]);
  useEffect(() => setSubscriptions(id, subscriptions), [id, setSubscriptions, subscriptions]);
  useCleanup(() => setSubscriptions(id, []));
};

function getBlocksFromPlayerState({
  playerState,
}: {
  playerState: PlayerState;
}): readonly (MemoryCacheBlock | undefined)[] | undefined {
  return playerState.progress.messageCache?.blocks;
}

// A note: for the moment,
//  - not all players provide blocks, and
//  - topics for webviz nodes are not available in blocks when blocks _are_ provided,
// so all consumers need a "regular playback" pipeline fallback for now.
// Consumers can rely on the presence of topics in messageDefinitionsByTopic to signal whether
// a fallback is needed for a given topic, because entries will not be populated in these cases.
export function useBlocksByTopic(topics: readonly string[]): BlocksForTopics {
  const requestedTopics = useShallowMemo(topics);

  // Subscribe to the topics
  useSubscribeToTopicsForBlocks(requestedTopics);

  // Get player data needed.
  const parsedMessageDefinitionsByTopic = useMessagePipeline(
    useCallback(
      ({ playerState }: { playerState: PlayerState }) =>
        playerState.activeData?.parsedMessageDefinitionsByTopic,
      [],
    ),
  );

  // Get blocks for the topics
  const allBlocks = useMessagePipeline<readonly (MemoryCacheBlock | undefined)[] | undefined>(
    getBlocksFromPlayerState,
  );

  const exposeBlockData = !!allBlocks; // The websocket player does not expose blocks.

  const messageReadersByTopic = useMemo(() => {
    if (!exposeBlockData) {
      // Do not provide any readers if the player does not provide blocks. A missing reader
      // signals that binary data will never appear for a topic.
      return {};
    }
    const result: Record<string, MessageReader> = {};
    for (const topic of requestedTopics) {
      const parsedDefinition = parsedMessageDefinitionsByTopic?.[topic];
      if (parsedDefinition) {
        result[topic] = new MessageReader(parsedDefinition);
      }
    }
    return result;
  }, [parsedMessageDefinitionsByTopic, requestedTopics, exposeBlockData]);
  const presentTopics = useMemo(() => Object.keys(messageReadersByTopic), [messageReadersByTopic]);

  const blocks = useMemo(() => {
    if (!allBlocks) {
      return [];
    }
    const ret = [];
    // Note: allBlocks.map() misbehaves, because allBlocks is initialized like "new Array(...)".
    for (let i = 0; i < allBlocks.length; ++i) {
      ret.push(filterBlockByTopics(allBlocks[i], presentTopics));
    }
    return ret;
  }, [allBlocks, presentTopics]);
  return useShallowMemo({ messageReadersByTopic, blocks });
}
