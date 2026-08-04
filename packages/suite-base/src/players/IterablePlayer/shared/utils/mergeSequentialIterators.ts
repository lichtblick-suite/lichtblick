// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Heap } from "heap-js";

import { compare, toMillis } from "@lichtblick/rostime";
import {
  IIterableSource,
  IteratorResult,
  MessageIteratorArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import {
  SequentialIteratorMergeOptions,
  SourceWithTime,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/types";

/**
 * Lazily merges sources in start-time order, activating each iterator only when playback reaches
 * that source's time range. This avoids starting remote reads for every file at once.
 */
export async function* mergeSequentialIterators<T extends IteratorResult>(
  sources: IIterableSource[],
  args: MessageIteratorArgs,
): AsyncIterableIterator<Readonly<T>> {
  // Separate sources into those with known time ranges and those without.
  // Sources without time ranges are started immediately (conservative approach).
  const sourcesWithTime: SourceWithTime[] = [];
  const sourcesWithoutTime: IIterableSource[] = [];

  for (const source of sources) {
    const startTime = source.getStart?.();
    const endTime = source.getEnd?.();
    if (startTime && endTime) {
      sourcesWithTime.push({ source, startTime, endTime });
    } else {
      sourcesWithoutTime.push(source);
    }
  }

  sourcesWithTime.sort((a, b) => compare(a.startTime, b.startTime));

  const heap = new Heap<SequentialIteratorMergeOptions<T>>(
    (a, b) => getTime(a.value) - getTime(b.value),
  );

  // Tracks every iterator that has been activated (messageIterator() called and not yet
  // exhausted). Unlike the heap, this includes the iterator whose value is currently being
  // yielded (removed from the heap by `pop()` before `yield`), so cancellation while suspended
  // at that yield can still clean it up in `finally`.
  const activeIterators = new Set<AsyncIterableIterator<Readonly<IteratorResult>>>();

  /** Activate a source iterator and push its first value onto the heap if present. */
  async function activateSource(source: IIterableSource): Promise<void> {
    const iterator = source.messageIterator(args);
    activeIterators.add(iterator);
    const result = await iterator.next();
    if (!(result.done ?? false)) {
      heap.push({ value: result.value as T, iterator });
    } else {
      // Exhausted immediately (empty source): nothing left to clean up.
      activeIterators.delete(iterator);
    }
  }

  // Start sources without time info eagerly.
  for (const source of sourcesWithoutTime) {
    await activateSource(source);
  }

  // Index into the sorted sourcesWithTime array tracking the next source to potentially activate
  let nextSourceIndex = 0;

  /** Activate the next pending timed source. */
  async function activateNextSource(): Promise<void> {
    await activateSource(sourcesWithTime[nextSourceIndex]!.source);
    nextSourceIndex++;
  }

  // On seek, start only sources whose range can contain queryStart; otherwise start just the
  // earliest source. Additional sources are activated lazily as playback reaches them so we do
  // not open remote reads for every file up front.
  const queryStart = args.start;
  if (queryStart != undefined) {
    // Skip sources that end before queryStart.
    while (nextSourceIndex < sourcesWithTime.length) {
      const sourceInfo = sourcesWithTime[nextSourceIndex]!;
      if (compare(sourceInfo.endTime, queryStart) >= 0) {
        break;
      }
      nextSourceIndex++;
    }
    // Activate sources that contain queryStart.
    while (nextSourceIndex < sourcesWithTime.length) {
      const sourceInfo = sourcesWithTime[nextSourceIndex]!;
      if (compare(sourceInfo.startTime, queryStart) > 0) {
        break;
      }
      await activateNextSource();
    }
  } else {
    // No query start: activate only the first source.
    if (nextSourceIndex < sourcesWithTime.length) {
      await activateNextSource();
    }
  }

  // If the initial source(s) were empty, advance through pending sources until
  // we find one with data or exhaust all sources.
  while (heap.isEmpty() && nextSourceIndex < sourcesWithTime.length) {
    await activateNextSource();
  }

  try {
    while (!heap.isEmpty()) {
      const node = heap.pop()!;
      const currentTimeMs = getTime(node.value);

      // Activate any pending sources whose startTime is <= the current message time.
      while (nextSourceIndex < sourcesWithTime.length) {
        const sourceInfo = sourcesWithTime[nextSourceIndex]!;
        if (toMillis(sourceInfo.startTime) > currentTimeMs) {
          break;
        }
        await activateNextSource();
      }

      yield node.value;

      const nextResult = await node.iterator.next();
      if (!(nextResult.done ?? false)) {
        heap.push({ value: nextResult.value as T, iterator: node.iterator });
      } else {
        activeIterators.delete(node.iterator);
        if (heap.isEmpty() && nextSourceIndex < sourcesWithTime.length) {
          // Heap is empty but timed sources remain; activate the next one.
          await activateNextSource();
        }
      }
    }
  } finally {
    // Close every iterator that is still active — this includes any left in the heap AND the
    // one whose value was mid-yield when the consumer cancelled (that node was already popped
    // from the heap by `pop()` before `yield`, so it would otherwise be skipped here, leaking
    // any resources it holds open — e.g. a pinned HydratedSourcePool entry in McapIterableSource).
    await Promise.allSettled(
      [...activeIterators].map(async (iterator) => {
        await iterator.return?.();
      }),
    );
  }
}

function getTime(event: IteratorResult): number {
  if (event.type === "message-event") {
    return toMillis(event.msgEvent.receiveTime);
  }
  if (event.type === "stamp") {
    return toMillis(event.stamp);
  }
  return Number.MAX_SAFE_INTEGER;
}
