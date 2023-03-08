// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom";

import Logger from "@foxglove/log";
import { IDataSourceFactory } from "@foxglove/studio-base";

import VersionBanner from "./VersionBanner";

const log = Logger.getLogger(__filename);

function LogAfterRender(props: React.PropsWithChildren<unknown>): JSX.Element {
  useEffect(() => {
    // Integration tests look for this console log to indicate the app has rendered once
    const level = log.getLevel();
    log.setLevel("debug");
    log.debug("App rendered");
    log.setLevel(level);
  }, []);
  return <>{props.children}</>;
}

type MainParams = {
  dataSources?: IDataSourceFactory[];
  extraProviders?: JSX.Element[];
};

export async function main(params: MainParams = {}): Promise<void> {
  log.debug("initializing");

  window.onerror = (...args) => {
    console.error(...args);
  };

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("missing #root element");
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

  if (!canRenderApp) {
    ReactDOM.render(
      <StrictMode>
        <LogAfterRender>{banner}</LogAfterRender>
      </StrictMode>,
      rootEl,
    );
    return;
  }

  const { installDevtoolsFormatters, overwriteFetch, waitForFonts, initI18n } = await import(
    "@foxglove/studio-base"
  );
  installDevtoolsFormatters();
  overwriteFetch();
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();
  await initI18n();

  const { Root } = await import("./Root");

  ReactDOM.render(
    <StrictMode>
      <LogAfterRender>
        {banner}
        <Root extraProviders={params.extraProviders} dataSources={params.dataSources} />
      </LogAfterRender>
    </StrictMode>,
    rootEl,
  );
}
