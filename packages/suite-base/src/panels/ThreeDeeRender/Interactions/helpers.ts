// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
