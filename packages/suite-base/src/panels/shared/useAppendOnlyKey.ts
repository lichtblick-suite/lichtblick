// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useRef } from "react";

/**
 * Joins `segments` into a "|"-separated key that only changes when an existing segment is
 * edited, reordered, or removed - appending new segments to the end leaves it unchanged. Useful
 * for a `resetKey` that shouldn't reset state (e.g. delta measure mode markers) just because the
 * user added a new series/path.
 */
function useAppendOnlyKey(segments: readonly string[]): string {
  const previousSegmentsRef = useRef<readonly string[] | undefined>(undefined);
  const stableKeyRef = useRef("");
  const previous = previousSegmentsRef.current;

  // `undefined` (not yet initialized) must never vacuously count as "append-only" via Array.every.
  const isAppendOnly =
    previous != undefined &&
    segments.length >= previous.length &&
    previous.every((value, index) => segments[index] === value);

  // Track the true latest segments regardless, so a later edit/removal is compared against them -
  // but only recompute the exposed key on a real change, so pure appends leave it untouched.
  previousSegmentsRef.current = segments;
  if (!isAppendOnly) {
    stableKeyRef.current = segments.join("|");
  }

  return stableKeyRef.current;
}

export default useAppendOnlyKey;
