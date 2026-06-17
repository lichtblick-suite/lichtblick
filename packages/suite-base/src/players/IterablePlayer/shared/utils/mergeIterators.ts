// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Heap } from "heap-js";

import { toMillis } from "@lichtblick/rostime";
import { IteratorResult } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

type MergeNode = {
  value: Readonly<IteratorResult<Uint8Array>>;
  iterator: AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>>;
};

/**
 * Eagerly merges several message iterators into a single time-ordered iterator.
 *
 * Unlike `mergeSequentialIterators` (which lazily activates sources to avoid issuing concurrent
 * HTTP requests for many non-overlapping remote files), this merge primes every iterator upfront.
 * That guarantees correct interleaving even when sources overlap the whole timeline — e.g. a small
 * synthetic source (tags) merged with the primary MCAP source. It is intended for a small number
 * of sources where eager activation is cheap.
 */
export async function* mergeMessageIterators(
  iterators: AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>>[],
): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
  const heap = new Heap<MergeNode>((a, b) => getTime(a.value) - getTime(b.value));

  // Prime the heap with the first value from each iterator.
  await Promise.all(
    iterators.map(async (iterator) => {
      const result = await iterator.next();
      if (!(result.done ?? false)) {
        heap.push({ value: result.value, iterator });
      }
    }),
  );

  try {
    while (!heap.isEmpty()) {
      const node = heap.pop()!;
      yield node.value;

      const next = await node.iterator.next();
      if (!(next.done ?? false)) {
        heap.push({ value: next.value, iterator: node.iterator });
      }
    }
  } finally {
    // Close all iterators to release resources if the consumer breaks early.
    await Promise.all(
      iterators.map(async (iterator) => {
        await iterator.return?.();
      }),
    );
  }
}

function getTime(event: Readonly<IteratorResult<Uint8Array>>): number {
  if (event.type === "message-event") {
    return toMillis(event.msgEvent.receiveTime);
  }
  if (event.type === "stamp") {
    return toMillis(event.stamp);
  }
  return Number.MAX_SAFE_INTEGER;
}

