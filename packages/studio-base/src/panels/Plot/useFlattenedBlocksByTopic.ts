// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { sumBy, transform } from "lodash";
import { useMemo, useState } from "react";

import { Immutable } from "@foxglove/studio";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { MessageBlock, MessageEvent } from "@foxglove/studio-base/players/types";

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

/**
 * Flattens incoming blocks into per-topic allFrames arrays.
 *
 * Internally this is implemented via cursor and an accumulating arrays instead of
 * returning new arrays on each invocation to improve performance.
 *
 * @param blocks blocks containing messages
 * @param topics to load from blocks
 * @returns flattened per-topic arrays of messages
 */
export function useFlattenedBlocksByTopic(
  topics: readonly string[],
): Immutable<Record<string, MessageEvent[]>> {
  const [state, setState] = useState<State>(makeInitialState);

  const blocks = useMessagePipeline(selectBlocks);

  const memoryAvailable = useMemo(() => {
    const messageCount = sumBy(Object.values(state.messages), (msgs) => msgs.length);
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

  // Reset cursors and buffers if the first block has changed.
  const shouldResetState = blocks[0]?.messagesByTopic !== state.previousBlocks[0]?.messagesByTopic;

  if (shouldResetState || (blocks !== state.previousBlocks && memoryAvailable)) {
    // setState directly here instead of a useEffect to avoid an extra render.
    setState((oldState) => {
      // Rebuild message buffers and cursors from last state, resetting if we are
      // rebuilding from scratch.
      const newState = transform(
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

        for (const topic of topics) {
          const blockMessages = block.messagesByTopic[topic];
          if (blockMessages == undefined) {
            continue;
          }

          if (idx > (newState.cursors[topic] ?? -1)) {
            newState.messages[topic] = (newState.messages[topic] ?? []).concat(blockMessages);
            newState.cursors[topic] = idx;
          }
        }
      }

      return newState;
    });
  }

  return state.messages;
}
