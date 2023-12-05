// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksSubscriptions";
import { SubscribePayload } from "@foxglove/studio-base/players/types";

import { Messages } from "./internalTypes";

// We need to keep track of the block data we've already sent to the worker and
// detect when it has changed, which can happen when the user changes a user
// script or they trigger a subscription to different fields.
// mapping from topic -> the first message on that topic in the block
type FirstMessages = Record<string, unknown>;
type Cursors = Record<string, number>;
export type BlockState = {
  // for each block, a mapping from topic -> the first message on that topic
  messages: FirstMessages[];
  // a mapping from topic -> the index of the last block we sent
  cursors: Cursors;
};

export const initBlockState = (): BlockState => ({
  messages: [],
  cursors: {},
});

/**
 * Prune any topics not used by `subscriptions` from BlockState.
 */
export function refreshBlockTopics(
  subscriptions: SubscribePayload[],
  state: BlockState,
): BlockState {
  const { cursors, messages } = state;
  const topics = subscriptions.map((v) => v.topic);
  return {
    ...state,
    messages: messages.map((block) =>
      R.pipe(
        R.map((topic: string): [string, unknown] => [topic, block[topic]]),
        R.fromPairs,
      )(topics),
    ),
    cursors: R.pipe(
      R.map((topic: string): [string, number] => [topic, cursors[topic] ?? 0]),
      R.fromPairs,
    )(topics),
  };
}

type Range = [start: number, end: number];
type Update = {
  topic: string;
  range: Range;
  shouldReset: boolean;
};

function calculateUpdate(
  payload: SubscribePayload,
  cursors: Cursors,
  blocks: readonly MessageBlock[],
  blocksWithStatuses: [MessageBlock, FirstMessages][],
): Update {
  const { topic } = payload;
  const currentCursor = cursors[topic] ?? 0;

  // 1. check for any new, non-empty unsent blocks
  const lastNew = R.findLastIndex(
    (block) => block[topic] != undefined,
    blocks.slice(currentCursor),
  );
  const newCursor = lastNew === -1 ? currentCursor : lastNew + currentCursor + 1;

  // 2. check whether any blocks below the current cursor have changed
  const changes = blocksWithStatuses.map(([block, status]) => {
    const oldFirst = status[topic];
    return !R.equals(oldFirst, block[topic]?.[0]?.message) && oldFirst != undefined;
  });
  const lastChanged = R.findLastIndex(R.identity, changes);
  const haveChanged = lastChanged !== -1;

  if (!haveChanged || lastChanged >= currentCursor) {
    return {
      topic,
      range: [currentCursor, haveChanged ? Math.min(newCursor, lastChanged + 1) : newCursor],
      shouldReset: false,
    };
  }

  return {
    ...calculateUpdate(
      payload,
      {
        ...cursors,
        [topic]: 0,
      },
      blocks,
      blocksWithStatuses,
    ),
    shouldReset: true,
  };
}

/**
 * Inspect the state of `blocks` to determine what data needs to be sent to the
 * plot worker.
 */
export function processBlocks(
  blocks: readonly MessageBlock[],
  subscriptions: SubscribePayload[],
  state: BlockState,
): {
  state: BlockState;
  resetTopics: string[];
  newData: Messages[];
} {
  const { cursors } = state;
  const messages: FirstMessages[] = blocks.map((_, i) => state.messages[i] ?? {});
  const blocksWithStatuses = R.zip(blocks, messages);

  const updates: Update[] = R.pipe(
    R.map((v: SubscribePayload): Update => calculateUpdate(v, cursors, blocks, blocksWithStatuses)),
    // filter out any topics that neither changed nor had new data
    R.filter(({ shouldReset, range: [start, end] }: Update) => shouldReset || start !== end),
  )(subscriptions);

  const newMessages = R.reduce(
    (a: FirstMessages[], { topic, range: [start, end] }: Update) => {
      return R.pipe(
        (v: FirstMessages[]): [MessageBlock, FirstMessages][] => R.zip(blocks.slice(start, end), v),
        R.map(
          ([block, existing]: [MessageBlock, FirstMessages]): FirstMessages => ({
            ...existing,
            [topic]: block[topic]?.[0]?.message,
          }),
        ),
        R.concat(a.slice(0, start)),
        // eslint-disable-next-line no-underscore-dangle
        R.concat(R.__, a.slice(end)),
      )(a.slice(start, end));
    },
    messages,
    updates,
  );

  const newCursors = R.reduce(
    (a: Cursors, { topic, range: [, end] }: Update): Cursors => ({
      ...a,
      [topic]: end,
    }),
    cursors,
    updates,
  );

  const newData: Messages[] = R.pipe(
    R.reduce(
      (a: string[][], v: Update): string[][] => {
        const {
          topic,
          range: [start, end],
        } = v;
        for (let i = start; i < end; i++) {
          const bucket = a[i];
          if (bucket == undefined) {
            continue;
          }
          bucket.push(topic);
        }
        return a;
      },
      blocks.map((): string[] => []),
    ),
    R.zip(blocks),
    // remove all blocks that are empty or have no topics
    R.filter(([block, topics]) => !R.isEmpty(block) && topics.length > 0),
    R.map(([block, topics]) => R.pick(topics, block) as Messages),
  )(updates);

  return {
    state: {
      messages: newMessages,
      cursors: newCursors,
    },
    resetTopics: R.chain(({ topic, shouldReset }) => (shouldReset ? [topic] : []), updates),
    newData,
  };
}
