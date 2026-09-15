// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useRef } from "react";

/**
 * Joins `segments` into a "|"-separated key that only changes when an existing segment is
 * edited, reordered, or removed - appending new segments to the end (and editing the newly
 * appended segments) leaves it unchanged. Useful for a `resetKey` that shouldn't reset state
 * (e.g. delta measure mode markers) just because the user added a new series/path.
 */
function useAppendOnlyKey(segments: readonly string[]): string {
  const previousLengthRef = useRef(0);
  const baselineSegmentsRef = useRef<readonly string[] | undefined>(undefined);
  const stableKeyRef = useRef("");

  const baseline = baselineSegmentsRef.current;
  const previousLength = previousLengthRef.current;

  // An append-only transition keeps the baseline prefix intact and does not decrease length.
  const isAppendOnly =
    baseline != undefined &&
    segments.length >= previousLength &&
    baseline.every((value, index) => segments[index] === value);

  previousLengthRef.current = segments.length;

  if (!isAppendOnly) {
    baselineSegmentsRef.current = segments;
    stableKeyRef.current = segments.join("|");
  }

  return stableKeyRef.current;
}

export default useAppendOnlyKey;
