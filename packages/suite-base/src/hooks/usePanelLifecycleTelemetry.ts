// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect } from "react";

import { getTelemetry } from "@lichtblick/suite-base/util/telemetry";

/**
 * Emits the `panel.mount` / `panel.unmount` instant events for a panel.
 *
 * `panelId` must be the layout panel id (e.g. `Plot!abc`), never the user-visible title, so the
 * series stay stable and bounded. Nothing is emitted when `panelId` is undefined (panel rendered
 * outside a layout) and nothing is allocated when telemetry is disabled.
 */
export function usePanelLifecycleTelemetry(panelId: string | undefined, panelType: string): void {
  useEffect(() => {
    if (panelId == undefined || !getTelemetry().isEnabled()) {
      return undefined;
    }
    const labels = { panelId, panelType };
    getTelemetry().event("panel.mount", "instant", "panel", labels);
    return () => {
      // Re-read the sink: it may have been swapped or reset while the panel was mounted.
      const telemetry = getTelemetry();
      if (telemetry.isEnabled()) {
        telemetry.event("panel.unmount", "instant", "panel", labels);
      }
    };
  }, [panelId, panelType]);
}
