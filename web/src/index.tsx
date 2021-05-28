// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { init as initSentry } from "@sentry/browser";
import ReactDOM from "react-dom";

import "@foxglove/studio-base/styles/global.scss";

import Logger from "@foxglove/log";
import { installDevtoolsFormatters, overwriteFetch, waitForFonts } from "@foxglove/studio-base";

import Root from "./Root";

const log = Logger.getLogger(__filename);

log.debug("initializing");

if (typeof process.env.SENTRY_DSN === "string") {
  log.info("initializing Sentry");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    // Remove the default breadbrumbs integration - it does not accurately track breadcrumbs and
    // creates more noise than benefit.
    integrations: (integrations) => {
      return integrations.filter((integration) => {
        return integration.name !== "Breadcrumbs";
      });
    },
    maxBreadcrumbs: 10,
  });
}

installDevtoolsFormatters();
overwriteFetch();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

async function main() {
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  ReactDOM.render(<Root />, rootEl, () => {
    // Integration tests look for this console log to indicate the app has rendered once
    log.debug("App rendered");
  });
}

main();
