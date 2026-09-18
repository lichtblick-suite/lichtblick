// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createRoot } from "react-dom/client";

import Logger from "@lichtblick/log";
import { initI18n } from "@lichtblick/suite-base";
import { IdbLayoutStorage } from "@lichtblick/suite-base/IdbLayoutStorage";

const log = Logger.getLogger(__filename);
log.debug("initializing");

window.onerror = (...args) => {
  console.error(...args);
};

async function main() {
  const { overwriteFetch, waitForFonts } = await import("@lichtblick/suite-base");
  console.log("CALLING MAIN");
  overwriteFetch();
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  await initI18n();

  // Ensure the scenario's layout is persisted *before* the app (and its `CurrentLayoutProvider`)
  // mounts: `Root.tsx` passes `appParameters.defaultLayout` for a deterministic initial
  // selection, but that only works if the named layout already exists by the time
  // `CurrentLayoutProvider`'s mount-time restoration effect looks for it.
  const { getScenarioFromUrl } = await import("./scenarios/registry");
  const scenario = getScenarioFromUrl(new URL(window.location.href));
  if (scenario) {
    const { LAYOUTS } = await import("./layouts");
    const layoutData = LAYOUTS[scenario.layout];
    if (layoutData) {
      const { setupScenarioLayout } = await import("./scenarios/setupScenarioLayout");
      const layoutStorage = new IdbLayoutStorage();

      await setupScenarioLayout(layoutStorage, scenario.id, layoutData).catch((error: unknown) => {
        log.error(`Failed to pre-install layout for scenario "${scenario.id}"`, error);
      });
    }
  }

  const { Root } = await import("./Root");

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("missing #root element");
  }

  const root = createRoot(rootEl);
  root.render(<Root />);
}

void main();
