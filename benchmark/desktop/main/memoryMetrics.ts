// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { App, IpcMain } from "electron";

import { GET_MEMORY_METRICS_CHANNEL } from "../common/types";

/** Registers the IPC handler backing `window.lichtblickBenchmark.getMemoryMetrics()`. */
export function registerMemoryMetricsHandler(
  ipcMainInstance: Pick<IpcMain, "handle">,
  appInstance: Pick<App, "getAppMetrics">,
): void {
  ipcMainInstance.handle(GET_MEMORY_METRICS_CHANNEL, () => appInstance.getAppMetrics());
}
