// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Make Electron type definitions available globally, such as extensions to File and other built-ins
/// <reference types="electron" />

import { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom";

import { Sockets } from "@foxglove/electron-socket/renderer";
import Logger from "@foxglove/log";
import {
  installDevtoolsFormatters,
  overwriteFetch,
  waitForFonts,
  initI18n,
  IDataSourceFactory,
  IAppConfiguration,
} from "@foxglove/studio-base";

import Root from "./Root";

const log = Logger.getLogger(__filename);

function LogAfterRender(props: React.PropsWithChildren): JSX.Element {
  useEffect(() => {
    // Integration tests look for this console log to indicate the app has rendered once
    // We use console.debug to bypass our logging library which hides some log levels in prod builds
    console.debug("App rendered");
  }, []);
  return <>{props.children}</>;
}

type MainParams = {
  dataSources?: IDataSourceFactory[];
  extraProviders?: JSX.Element[];
  appConfiguration: IAppConfiguration;
};

export async function main(params: MainParams): Promise<void> {
  log.debug("initializing renderer");

  installDevtoolsFormatters();
  overwriteFetch();

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("missing #root element");
  }

  // Initialize the RPC channel for electron-socket. This method is called first
  // since the window.onmessage handler needs to be installed before
  // window.onload fires
  await Sockets.Create();

  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();
  await initI18n();

  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(
    <StrictMode>
      <LogAfterRender>
        <Root
          appConfiguration={params.appConfiguration}
          extraProviders={params.extraProviders}
          dataSources={params.dataSources}
        />
      </LogAfterRender>
    </StrictMode>,
    rootEl,
  );
}
