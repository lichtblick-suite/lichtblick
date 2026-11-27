// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Progress } from "@lichtblick/suite-base/players/types";

import { FULLY_PRELOADED_EPSILON } from "./constants";

/**
 * True when the fraction ranges reported by the BlockLoader cover the whole [0, 1] range (within
 * `FULLY_PRELOADED_EPSILON`). Ranges are assumed non-overlapping, as the BlockLoader reports them.
 * Undefined ranges (no load progress reported yet) never cover the range.
 */
export function coversFullRange(ranges: Progress["fullyLoadedFractionRanges"]): boolean {
  if (ranges == undefined) {
    return false;
  }
  let covered = 0;
  for (const range of ranges) {
    covered += range.end - range.start;
  }
  return covered >= 1 - FULLY_PRELOADED_EPSILON;
}
