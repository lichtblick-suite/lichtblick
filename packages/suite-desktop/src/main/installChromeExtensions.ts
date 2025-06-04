// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import installExtension, { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";

import { PromiseTimeoutError, promiseTimeout } from "@lichtblick/den/async";
import Logger from "@lichtblick/log";

const log = Logger.getLogger(__filename);

export default async function installChromeExtensions(): Promise<void> {
  log.info("Installing Chrome extensions for development...");

  try {
    // Extension installation sometimes gets stuck between the download step and the extension loading step, for unknown reasons.
    // So don't wait indefinitely for installation to complete.
    const result = await promiseTimeout(installExtension(REACT_DEVELOPER_TOOLS), 5000);
    log.info("Finished extension install:", result);
  } catch (err: unknown) {
    if (err instanceof PromiseTimeoutError) {
      console.warn(
        "Warning: extension installation may be stuck; try relaunching electron or deleting its extensions directory. Continuing for now.",
      );
      return;
    }
    throw err;
  }
}
