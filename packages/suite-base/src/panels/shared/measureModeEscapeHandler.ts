// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { UseDeltaMarkerStateResult } from "@lichtblick/suite-base/panels/shared/useDeltaMarkerState";

export type MeasureModeState = Pick<UseDeltaMarkerStateResult, "active" | "toggleActive">;

/**
 * Builds the `escape` KeyListener handler shared by the Plot and StateTransitions panels: exits
 * measure mode when active, otherwise returns `false` so KeyListener leaves Escape's default
 * behavior alone (see KeyListener's `return false` contract).
 */
export function createMeasureModeEscapeHandler({
  active,
  toggleActive,
}: MeasureModeState): () => boolean | void {
  return () => {
    if (active) {
      toggleActive();
      return;
    }
    return false;
  };
}
