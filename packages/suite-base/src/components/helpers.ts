// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LOCAL_STORAGE_PANEL_LOGS_HEIGHT } from "@lichtblick/suite-base/constants/browserStorageKeys";
import { MAX_HEIGHT } from "@lichtblick/suite-base/constants/panelLogs";

/** Helper function to load saved panel logs height from localStorage */
export function loadPanelLogsHeight(): number {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_PANEL_LOGS_HEIGHT);
    if (saved != undefined) {
      const height = parseInt(saved, 10);
      return isNaN(height) ? MAX_HEIGHT : height;
    }
  } catch {
    // Ignore localStorage errors
  }
  return MAX_HEIGHT;
}

/** Helper function to save panel logs height to localStorage */
export function savePanelLogsHeight(height: number): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PANEL_LOGS_HEIGHT, height.toString());
  } catch {
    // Ignore localStorage errors
  }
}
