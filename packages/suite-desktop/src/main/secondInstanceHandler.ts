// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BrowserWindow, app } from "electron";

import log from "@lichtblick/log";

import { createNewWindow } from "./createNewWindow";
import { isFileToOpen } from "./fileUtils";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function handleSecondInstance(_ev: unknown, argv: string[], _workingDirectory: string) {
  log.debug("Received arguments from second app instance:", argv);
  const multipleWindows = argv.includes("--force-multiple-windows");

  const deepLinks = argv.slice(1).filter((arg) => arg.startsWith("lichtblick://"));
  const files = argv
    .slice(1)
    .filter((arg) => !arg.startsWith("--"))
    .filter((arg) => isFileToOpen(arg));

  if (multipleWindows) {
    log.debug("second-instance: Forcing a new window to run in this instance.");
    createNewWindow(argv);
    return;
  }

  if (files.length > 0 || deepLinks.length > 0) {
    log.debug("second-instance: Opening new window due to file or deeplink.");

    for (const link of deepLinks) {
      app.emit("open-url", { preventDefault() {} }, link);
    }

    for (const file of files) {
      app.emit("open-file", { preventDefault() {} }, file);
    }
    return;
  } else {
    // Bring the app to the front
    const someWindow = BrowserWindow.getAllWindows()[0];
    someWindow?.restore();
    someWindow?.focus();
  }
}
