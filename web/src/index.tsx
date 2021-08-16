// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { init as initSentry } from "@sentry/browser";
import ReactDOM from "react-dom";

import Logger from "@foxglove/log";

import VersionBanner from "./VersionBanner";

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
    ignoreErrors: ["ResizeObserver loop limit exceeded"],
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

async function main() {
  const searchParams = new URLSearchParams(window.location.search);
  const demoMode = searchParams.get("demo") != undefined;
  if (demoMode) {
    // Remove ?demo from the page URL so reloading the page doesn't save a new copy of the demo layout.
    searchParams.delete("demo");
    history.replaceState(undefined, "", `${window.location.pathname}?${searchParams.toString()}`);
  }
  const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)\./);
  const chromeVersion = chromeMatch ? parseInt(chromeMatch[1] ?? "", 10) : 0;
  const isChrome = chromeVersion !== 0;

  const canRenderApp = typeof BigInt64Array === "function" && typeof BigUint64Array === "function";
  const banner = (
    <VersionBanner
      isChrome={isChrome}
      currentVersion={chromeVersion}
      isDismissable={canRenderApp}
    />
  );
  const renderCallback = () => {
    // Integration tests look for this console log to indicate the app has rendered once
    log.debug("App rendered");
  };

  if (!canRenderApp) {
    ReactDOM.render(banner, rootEl, renderCallback);
    return;
  }

  const { installDevtoolsFormatters, overwriteFetch, waitForFonts } = await import(
    "@foxglove/studio-base"
  );
  installDevtoolsFormatters();
  overwriteFetch();
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  const { Root } = await import("./Root");
  ReactDOM.render(
    <>
      {banner}
      <Root loadWelcomeLayout={demoMode} />
    </>,
    rootEl,
    renderCallback,
  );
}

void main();
