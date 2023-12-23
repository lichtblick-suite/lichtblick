// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as R from "ramda";

import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksSubscriptions";
import { SubscribePayload, MessageEvent } from "@foxglove/studio-base/players/types";

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

/**
 * An Update describes the set of data that should be ingested by a client in
 * the plot worker.
 */
export type Update = {
  topic: string;
  // The range of blocks that should be ingested in the form [start index, end
  // index).
  blockRange: Range;
  // Whether the plot data the client already has should be thrown out. This
  // happens when either the plot's parameters change or the underlying data
  // does.
  shouldReset: boolean;
};

/**
 * An Update for a specific client.
 */
export type ClientUpdate = {
  id: string;
  update: Update;
};

/**
 * A BlockUpdate describes the "work to be done" for new block data in the
 * worker.
 */
export type BlockUpdate = {
  // Contains all of the data ingestion "jobs".
  updates: ClientUpdate[];
  // Contains the data used to fulfill those jobs.
  messages: Record<string, (readonly MessageEvent[])[]>;
};

/**
 * Calculate the range that contains all provided ranges.
 */
function combineRanges(ranges: Range[]): Range | undefined {
  const [first] = ranges;
  if (first == undefined) {
    return undefined;
  }

  return ranges.reduce(
    ([minA, maxA]: Range, [minB, maxB]: Range) => [Math.min(minA, minB), Math.max(maxA, maxB)],
    first,
  );
}

/**
 * prepareUpdate aggregates a list of client updates and produces a
 * `BlockUpdate` that contains the minimal set of data necessary to satisfy all
 * of the clients' requests. It includes only the block data each client needs
 * and rewrites the `range` field of each `Update` to reference parts of the
 * consolidated message data.
 *
 * We use this to minimize the amount of data we send to the worker in any one
 * step; if two clients need the same data, we do not send it twice.
 */
export function prepareBlockUpdate(
  updates: ClientUpdate[],
  blocks: readonly MessageBlock[],
): BlockUpdate {
  // Consolidate all updates for each topic
  const updatesByTopic = R.groupBy(({ update: { topic } }: ClientUpdate) => topic, updates);

  // Calculate the minimum block range we need to satisfy all requests for each topic
  const rangeByTopic = R.map(
    (topicUpdates) =>
      combineRanges((topicUpdates ?? []).map(({ update: { blockRange } }) => blockRange)),
    updatesByTopic,
  );

  // Slice off _only_ the messages that we need to satisfy the requests
  const messages = R.mapObjIndexed((range: Range | undefined, topic: string) => {
    if (range == undefined) {
      return [];
    }
    const [start, end] = range;
    return blocks.slice(start, end).map((v): readonly MessageEvent[] => v[topic] ?? []);
  }, rangeByTopic);

  // We need to transform the ranges of all of the original updates such that
  // they specify ranges relative to the blocks contained in `messages`
  const newUpdates = updates.map((clientUpdate: ClientUpdate): ClientUpdate => {
    const {
      update,
      update: { topic, blockRange },
    } = clientUpdate;

    const newRange = rangeByTopic[topic];
    if (newRange == undefined) {
      return clientUpdate;
    }

    const [newMin] = newRange;
    const [oldMin, oldMax] = blockRange;

    return {
      ...clientUpdate,
      update: {
        ...update,
        blockRange: [oldMin - newMin, oldMax - newMin],
      },
    };
  });

  return {
    messages,
    updates: newUpdates,
  };
}

/**
 * Decide which blocks need to be sent to the worker and, if necessary, whether
 * the worker's state needs to be reset.
 */
function calculateUpdate(
  payload: SubscribePayload,
  cursors: Cursors,
  blocks: readonly MessageBlock[],
  blocksWithStatuses: [MessageBlock, FirstMessages][],
): Update {
  const { topic } = payload;
  const currentCursor = cursors[topic] ?? 0;

  // 1. check for any new, non-empty unsent blocks
  const lastNew = R.findLastIndex((block) => {
    const data = block[topic];
    return data != undefined && data.length !== 0;
  }, blocks.slice(currentCursor));
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
      blockRange: [currentCursor, haveChanged ? Math.min(newCursor, lastChanged + 1) : newCursor],
      shouldReset: currentCursor === 0,
    };
  }
  return {
    topic,
    blockRange: [0, lastChanged + 1],
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
  updates: Update[];
} {
  const { cursors } = state;
  const messages: FirstMessages[] = blocks.map((_, i) => state.messages[i] ?? {});
  const blocksWithStatuses = R.zip(blocks, messages);

  const updates: Update[] = R.pipe(
    R.map((v: SubscribePayload): Update => calculateUpdate(v, cursors, blocks, blocksWithStatuses)),
    // filter out any topics that neither changed nor had new data
    R.filter(({ shouldReset, blockRange: [start, end] }: Update) => shouldReset || start !== end),
  )(subscriptions);

  const newMessages = R.reduce(
    (a: FirstMessages[], { topic, blockRange: [start, end] }: Update) => {
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
    (a: Cursors, { topic, blockRange: [, end] }: Update): Cursors => ({
      ...a,
      [topic]: end,
    }),
    cursors,
    updates,
  );

  return {
    state: {
      messages: newMessages,
      cursors: newCursors,
    },
    updates,
  };
}
