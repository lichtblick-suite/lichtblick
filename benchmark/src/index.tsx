// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createRoot } from "react-dom/client";

import Logger from "@lichtblick/log";
import { initI18n } from "@lichtblick/suite-base";

const log = Logger.getLogger(__filename);
log.debug("initializing");

window.onerror = (...args) => {
  console.error(...args);
};

async function main() {
  const { overwriteFetch, waitForFonts } = await import("@lichtblick/suite-base");
  overwriteFetch();
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  await initI18n();

  const { Root } = await import("./Root");

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("missing #root element");
  }

  const root = createRoot(rootEl);
  root.render(<Root />);
}

void main();
