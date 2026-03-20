// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time, compare } from "@lichtblick/rostime";
import { IIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

/**
 * Returns true if the source's time range [getStart(), getEnd()] overlaps with
 * the query range [start, end]. If the source does not report start/end times,
 * returns true (conservative — assume it might be relevant).
 */
export function sourceOverlapsRange<T>(
  source: IIterableSource<T>,
  start?: Time,
  end?: Time,
): boolean {
  // If no query range is specified, all sources are relevant
  if (!start || !end) {
    return true;
  }

  const sourceStart = source.getStart?.();
  const sourceEnd = source.getEnd?.();

  // If the source doesn't report its time range, assume it's relevant
  if (!sourceStart || !sourceEnd) {
    return true;
  }

  // Two ranges [A, B] and [C, D] overlap iff A <= D && C <= B
  return compare(sourceStart, end) <= 0 && compare(start, sourceEnd) <= 0;
}

/**
 * Filters sources to only those whose time range overlaps with [start, end].
 * Sources without getStart/getEnd are always included.
 */
export function filterSourcesByTimeRange<T>(
  sources: IIterableSource<T>[],
  start?: Time,
  end?: Time,
): IIterableSource<T>[] {
  return sources.filter((source) => sourceOverlapsRange(source, start, end));
}

/**
 * For backfill operations, returns sources that could contain messages at or before
 * the given time. A source is relevant if its start time is <= the backfill time.
 */
export function filterSourcesForBackfill<T>(
  sources: IIterableSource<T>[],
  time: Time,
): IIterableSource<T>[] {
  return sources.filter((source) => {
    const sourceStart = source.getStart?.();
    // If the source doesn't report start time, include it conservatively
    if (!sourceStart) {
      return true;
    }
    // Source is relevant if it starts at or before the backfill time
    return compare(sourceStart, time) <= 0;
  });
}
