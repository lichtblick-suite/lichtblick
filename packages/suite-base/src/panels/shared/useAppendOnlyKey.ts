// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useRef } from "react";

/**
 * Joins `segments` into a "|"-separated key that stays stable across append-only updates but
 * changes when an existing segment is edited, reordered, removed, or restored. Each non-append
 * transition increments a monotonic revision suffix so stale markers/config state is reset even if
 * the remaining segments match an earlier snapshot.
 */
function useAppendOnlyKey(segments: readonly string[]): string {
  const previousLengthRef = useRef(0);
  const baselineSegmentsRef = useRef<readonly string[] | undefined>(undefined);
  const stableKeyRef = useRef("");
  const revisionRef = useRef(0);

  const baseline = baselineSegmentsRef.current;
  const previousLength = previousLengthRef.current;

  const isAppendOnly =
    baseline != undefined &&
    segments.length >= previousLength &&
    baseline.every((value, index) => segments[index] === value);

  previousLengthRef.current = segments.length;

  if (baseline == undefined || !isAppendOnly) {
    baselineSegmentsRef.current = segments;
    revisionRef.current += 1;
    stableKeyRef.current = `${segments.join("|")}|${revisionRef.current}`;
  }

  return stableKeyRef.current;
}

export default useAppendOnlyKey;
