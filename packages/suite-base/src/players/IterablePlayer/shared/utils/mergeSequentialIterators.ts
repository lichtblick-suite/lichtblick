// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Heap } from "heap-js";

import { Time, toMillis, compare } from "@lichtblick/rostime";
import {
  IIterableSource,
  IteratorResult,
  MessageIteratorArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

type SourceWithTime = {
  source: IIterableSource;
  startTime: Time;
  endTime: Time;
};

/**
 * A lazy sequential iterator that only activates source iterators when the current
 * playback time reaches (or is near) that source's time range.
 *
 * This avoids starting HTTP byte-range requests for all remote MCAP files simultaneously.
 * Instead, only the source(s) covering the current time window are actively read from.
 *
 * Sources are sorted by start time. When the current yield time approaches a source's
 * start time, that source's iterator is initialized and added to the merge heap.
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

  // Sort by start time
  sourcesWithTime.sort((a, b) => compare(a.startTime, b.startTime));

  const heap = new Heap<{
    value: T;
    iterator: AsyncIterableIterator<Readonly<IteratorResult>>;
  }>((a, b) => getTime(a.value) - getTime(b.value));

  // Initialize sources that don't have time info (must be started eagerly)
  for (const source of sourcesWithoutTime) {
    const iterator = source.messageIterator(args);
    const result = await iterator.next();
    if (!(result.done ?? false)) {
      heap.push({ value: result.value as T, iterator });
    }
  }

  // Index into the sorted sourcesWithTime array tracking the next source to potentially activate
  let nextSourceIndex = 0;

  // Activate sources whose start time is at or before the query start time.
  // When no query start is provided, activate only the first source (the earliest by startTime)
  // to avoid starting HTTP requests for all files simultaneously.
  //
  // When a query start IS provided (e.g. after a seek), only activate sources whose time range
  // [startTime, endTime] actually contains the queryStart. Sources that end before queryStart
  // are skipped entirely — they cannot contain relevant data at the seek position.
  // This avoids activating all preceding sources when seeking to the end of the timeline.
  const queryStart = args.start;
  if (queryStart != undefined) {
    // Skip sources that end before queryStart (they can't contain messages at the seek point)
    while (nextSourceIndex < sourcesWithTime.length) {
      const sourceInfo = sourcesWithTime[nextSourceIndex]!;
      if (compare(sourceInfo.endTime, queryStart) >= 0) {
        break;
      }
      nextSourceIndex++;
    }
    // Activate sources that contain queryStart (startTime <= queryStart)
    while (nextSourceIndex < sourcesWithTime.length) {
      const sourceInfo = sourcesWithTime[nextSourceIndex]!;
      if (compare(sourceInfo.startTime, queryStart) > 0) {
        break;
      }
      const iterator = sourceInfo.source.messageIterator(args);
      const result = await iterator.next();
      if (!(result.done ?? false)) {
        heap.push({ value: result.value as T, iterator });
      }
      nextSourceIndex++;
    }
  } else {
    // No query start — activate only the first source
    if (nextSourceIndex < sourcesWithTime.length) {
      const sourceInfo = sourcesWithTime[nextSourceIndex]!;
      const iterator = sourceInfo.source.messageIterator(args);
      const result = await iterator.next();
      if (!(result.done ?? false)) {
        heap.push({ value: result.value as T, iterator });
      }
      nextSourceIndex++;
    }
  }

  // If the initial source(s) were empty, advance through pending sources until
  // we find one with data or exhaust all sources.
  while (heap.isEmpty() && nextSourceIndex < sourcesWithTime.length) {
    const sourceInfo = sourcesWithTime[nextSourceIndex]!;
    const iterator = sourceInfo.source.messageIterator(args);
    const result = await iterator.next();
    if (!(result.done ?? false)) {
      heap.push({ value: result.value as T, iterator });
    }
    nextSourceIndex++;
  }

  try {
    while (!heap.isEmpty()) {
      const node = heap.pop()!;
      const currentTimeMs = getTime(node.value);

      // Before yielding, check if any pending sources should be activated.
      // Activate sources whose startTime is <= the current message time.
      while (nextSourceIndex < sourcesWithTime.length) {
        const sourceInfo = sourcesWithTime[nextSourceIndex]!;
        if (toMillis(sourceInfo.startTime) > currentTimeMs) {
          break;
        }
        const iterator = sourceInfo.source.messageIterator(args);
        const result = await iterator.next();
        if (!(result.done ?? false)) {
          heap.push({ value: result.value as T, iterator });
        }
        nextSourceIndex++;
      }

      yield node.value;

      const nextResult = await node.iterator.next();
      if (!(nextResult.done ?? false)) {
        heap.push({ value: nextResult.value as T, iterator: node.iterator });
      } else if (heap.isEmpty() && nextSourceIndex < sourcesWithTime.length) {
        // Current heap is exhausted but there are still pending sources.
        // Activate the next source to continue yielding.
        const sourceInfo = sourcesWithTime[nextSourceIndex]!;
        const iterator = sourceInfo.source.messageIterator(args);
        const result = await iterator.next();
        if (!(result.done ?? false)) {
          heap.push({ value: result.value as T, iterator });
        }
        nextSourceIndex++;
      }
    }
  } finally {
    // Close all active iterators to release resources (e.g. HTTP connections)
    // when the consumer breaks early or the generator is discarded.
    for (const node of heap.toArray()) {
      await node.iterator.return?.();
    }
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
