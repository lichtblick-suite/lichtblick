// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Time (ms) the user must dwell on a single object before the tooltip
 * "settles". Once settled, moving to a new object delays the update by
 * HOVER_TOOLTIP_GRACE_PERIOD_MS, giving the user time to reach the tooltip.
 */
export const HOVER_TOOLTIP_DWELL_MS = 700;

/**
 * Grace period (ms) used in two situations:
 *  1. After the cursor leaves a settled object – delays updating to the next
 *     object so the user can move onto the tooltip and pin it.
 *  2. After entities clear completely – keeps the tooltip visible so the user
 *     has time to reach it.
 */
export const HOVER_TOOLTIP_GRACE_PERIOD_MS = 350;

/** Delay (ms) before tooltip hides after mouse leaves the tooltip. */
export const HOVER_TOOLTIP_LEAVE_DELAY_MS = 300;

/** Pixel offset from cursor to tooltip edge. */
export const HOVER_TOOLTIP_OFFSET_PX = 6;

/** Maximum tooltip width (px) – used for positioning calculations. Must match CSS maxWidth. */
export const HOVER_TOOLTIP_MAX_W = 620;

/** Maximum tooltip height (px) – used for positioning calculations. Must match CSS maxHeight. */
export const HOVER_TOOLTIP_MAX_H = 480;

/**
 * Clamp a tooltip along a single axis so it stays inside the given bounds.
 * Prefers placing it after the cursor; flips before if there isn't space;
 * falls back to the nearest edge otherwise.
 */
export function clampTooltipAxis(
  cursor: number,
  size: number,
  boundsStart: number,
  boundsEnd: number,
  offset: number,
): number {
  if (boundsEnd - cursor >= size + offset) {
    return cursor + offset;
  }
  if (cursor - boundsStart >= size + offset) {
    return cursor - size - offset;
  }
  return Math.max(boundsStart, boundsEnd - size);
}
