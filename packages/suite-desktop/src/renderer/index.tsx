// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Make Electron type definitions available globally, such as extensions to File and other built-ins
/// <reference types="electron" />

import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { Sockets } from "@lichtblick/electron-socket/renderer";
import Logger from "@lichtblick/log";
import {
  installDevtoolsFormatters,
  overwriteFetch,
  waitForFonts,
  initI18n,
  IDataSourceFactory,
  IAppConfiguration,
} from "@lichtblick/suite-base";

import Root from "./Root";
import { Desktop } from "../common/types";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;

const log = Logger.getLogger(__filename);

function LogAfterRender(props: React.PropsWithChildren): React.JSX.Element {
  useEffect(() => {
    // Integration tests look for this console log to indicate the app has rendered once
    // We use console.debug to bypass our logging library which hides some log levels in prod builds
    console.debug("App rendered");
  }, []);
  return <>{props.children}</>;
}

type MainParams = {
  dataSources?: IDataSourceFactory[];
  extraProviders?: React.JSX.Element[];
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

  const cliFlags = await desktopBridge.getCLIFlags();

  const root = createRoot(rootEl);
  root.render(
    <LogAfterRender>
      <Root
        appParameters={cliFlags}
        appConfiguration={params.appConfiguration}
        extraProviders={params.extraProviders}
        dataSources={params.dataSources}
      />
    </LogAfterRender>,
  );
}
