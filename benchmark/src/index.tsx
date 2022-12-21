// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);
log.debug("initializing");

window.onerror = (...args) => {
  console.error(...args);
};

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

function LogAfterRender(props: React.PropsWithChildren<unknown>): JSX.Element {
  useEffect(() => {
    // Integration tests look for this console log to indicate the app has rendered once
    log.debug("App rendered");
  }, []);
  return <>{props.children}</>;
}

async function main() {
  const { overwriteFetch, waitForFonts } = await import("@foxglove/studio-base");
  overwriteFetch();
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();

  const { Root } = await import("./Root");

  createRoot(rootEl!).render(
    <LogAfterRender>
      <Root />
    </LogAfterRender>,
  );
}

void main();
