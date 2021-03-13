// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { init as initSentry } from "@sentry/electron";
import ReactDOM from "react-dom";

import "@foxglove-studio/app/styles/global.scss";

import App from "@foxglove-studio/app/App";
import { getGlobalConfig } from "@foxglove-studio/app/GlobalConfig";
import installDevtoolsFormatters from "@foxglove-studio/app/util/installDevtoolsFormatters";
import overwriteFetch from "@foxglove-studio/app/util/overwriteFetch";
import waitForFonts from "@foxglove-studio/app/util/waitForFonts";

if (typeof process.env.SENTRY_DSN === "string") {
  initSentry({ dsn: process.env.SENTRY_DSN });
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

  // This should live within App and become part of startup
  await getGlobalConfig().load();

  ReactDOM.render(<App />, rootEl, () => {
    // Integration tests look for this console log to indicate the app has rendered once
    // eslint-disable-next-line no-restricted-syntax
    console.log("App rendered");
  });
}

main();
