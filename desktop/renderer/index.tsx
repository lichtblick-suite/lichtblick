// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Make Electron type definitions available globally, such as extensions to File and other built-ins
/// <reference types="electron" />

import { init as initSentry } from "@sentry/electron";
import ReactDOM from "react-dom";

import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import { installDevtoolsFormatters, overwriteFetch, waitForFonts } from "@foxglove/studio-base";

import pkgInfo from "../../package.json";
import Root from "./Root";

const log = Logger.getLogger(__filename);

log.debug("initializing renderer");

// preload injects the crash reporting global based on app settings received from the main process
const isCrashReportingEnabled =
  (global as { allowCrashReporting?: boolean }).allowCrashReporting ?? false;

if (isCrashReportingEnabled && typeof process.env.SENTRY_DSN === "string") {
  log.info("initializing Sentry in renderer");
  initSentry({
    dsn: process.env.SENTRY_DSN,
    autoSessionTracking: true,
    release: `${process.env.SENTRY_PROJECT}@${pkgInfo.version}`,
    // Remove the default breadbrumbs integration - it does not accurately track breadcrumbs and
    // creates more noise than benefit.
    integrations: (integrations) => {
      return integrations.filter((integration) => {
        return integration.name !== "Breadcrumbs";
      });
    },
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  });
}

installDevtoolsFormatters();
overwriteFetch();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

async function main() {
  // Initialize the RPC channel for electron-socket. This method is called first
  // since the window.onmessage handler needs to be installed before
  // window.onload fires
  await Sockets.Create();

  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  ReactDOM.render(<Root />, rootEl, () => {
    // Integration tests look for this console log to indicate the app has rendered once
    log.debug("App rendered");
  });
}

void main();
