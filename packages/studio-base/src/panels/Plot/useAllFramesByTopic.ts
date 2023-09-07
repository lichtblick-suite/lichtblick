// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";
import { Immutable } from "@foxglove/studio";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { MessageBlock, MessageEvent, SubscribePayload } from "@foxglove/studio-base/players/types";

const EmptyBlocks: MessageBlock[] = [];

type State = {
  cursors: Record<string, number>;
  messages: Record<string, MessageEvent[]>;
  previousBlocks: Immutable<Array<undefined | MessageBlock>>;
};

function makeInitialState(): State {
  return {
    cursors: {},
    messages: {},
    previousBlocks: [],
  };
}

const selectBlocks = (ctx: MessagePipelineContext) =>
  ctx.playerState.progress.messageCache?.blocks ?? EmptyBlocks;

const selectSetSubscriptions = (ctx: MessagePipelineContext) => ctx.setSubscriptions;

/**
 * Maintains subscriptions and flattens incoming blocks into per-topic allFrames arrays.
 *
 * Internally this is implemented via cursor and accumulating arrays instead of
 * returning new arrays on each invocation to improve performance.
 *
 * @param topics to load from blocks
 * @returns flattened per-topic arrays of messages
 */
export function useAllFramesByTopic(
  subscriptions: Immutable<SubscribePayload[]>,
): Immutable<Record<string, MessageEvent[]>> {
  const [state, setState] = useState(makeInitialState);

  const [subscriberId] = useState(() => uuidv4());

  const setSubscriptions = useMessagePipeline(selectSetSubscriptions);

  useEffect(() => {
    setSubscriptions(subscriberId, subscriptions);

    return () => {
      setSubscriptions(subscriberId, []);
    };
  }, [subscriberId, setSubscriptions, subscriptions]);

  const topics = useMemo(() => subscriptions.map((sub) => sub.topic), [subscriptions]);

  useEffect(() => {}, [subscriberId, setSubscriptions]);

  const blocks = useMessagePipeline(selectBlocks);

  const memoryAvailable = useMemo(() => {
    const messageCount = _.sumBy(Object.values(state.messages), (msgs) => msgs.length);
    if (messageCount >= 1_000_000) {
      // If we have memory stats we can let the user have more points as long as memory is
      // not under pressure.
      // foxglove-depcheck-used: @types/foxglove__web
      if (performance.memory) {
        const pct = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (isNaN(pct) || pct > 0.6) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  }, [state.messages]);

  // Reset cursors and buffers if the first block has changed or if our topic list doesn't
  // match our accumulated message topic list. We have to check this because as the topics
  // in the blocks can be a superset of the topics we're interested in.
  const shouldResetState = blocks[0]?.messagesByTopic !== state.previousBlocks[0]?.messagesByTopic;

  if (shouldResetState || (blocks !== state.previousBlocks && memoryAvailable)) {
    // setState directly here instead of a useEffect to avoid an extra render.
    setState((oldState) => {
      // Rebuild message buffers and cursors from last state, resetting if we are
      // rebuilding from scratch, making sure there is an entry in messages for all
      // requested topics even if we don't find messages for each topic in loaded blocks.
      const newState = _.transform(
        topics,
        (acc, topic) => {
          acc.cursors[topic] = shouldResetState ? -1 : oldState.cursors[topic] ?? -1;
          acc.messages[topic] = shouldResetState ? [] : oldState.messages[topic] ?? [];
        },
        { ...makeInitialState(), previousBlocks: blocks },
      );

      // append new messages to accumulating per-topic buffers and update cursors
      for (const [idx, block] of blocks.entries()) {
        if (block == undefined) {
          break;
        }

        // Only include fully loaded blocks. This is necessary because existing blocks may contain
        // messages on our topics but that have not been updated to contain the list of fields we're
        // currently subscribed for.
        if (block.needTopics?.size !== 0) {
          break;
        }

        // There is a delay between the time we set new subscriptions and the messages for
        // those subscriptions appear in blocks so we load all topics we find in blocks
        // here.
        for (const [topic, blockMessages] of Object.entries(block.messagesByTopic)) {
          if (idx > (newState.cursors[topic] ?? -1)) {
            if (blockMessages.length > 0) {
              newState.messages[topic] = (newState.messages[topic] ?? []).concat(blockMessages);
            }
            newState.cursors[topic] = idx;
          }
        }
      }

      return newState;
    });
  }

  // Stablize the flattened messages by shallow memoing the whole set after excluding empty topics.
  const stableMessagesWithData = useShallowMemo(
    _.pickBy(state.messages, (msgs) => msgs.length > 0),
  );

  return stableMessagesWithData;
}
