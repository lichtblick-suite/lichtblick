// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Reorders an item in a paths array from sourceIndex to targetIndex.
 * Used by panels that support reordering of series/paths.
 */
export function handleReorderSeriesAction<T extends { paths: unknown[] }>(
  draft: T,
  sourceIndex: number,
  targetIndex: number,
): void {
  if (
    sourceIndex === targetIndex ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= draft.paths.length ||
    targetIndex >= draft.paths.length
  ) {
    return;
  }
  const [removed] = draft.paths.splice(sourceIndex, 1);
  draft.paths.splice(targetIndex, 0, removed);
}
