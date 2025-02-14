// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import Logger from "@lichtblick/log";
import type { IDataSourceFactory } from "@lichtblick/suite-base";
import CssBaseline from "@lichtblick/suite-base/components/CssBaseline";

import { CompatibilityBanner } from "./CompatibilityBanner";
import { canRenderApp } from "./canRenderApp";

const log = Logger.getLogger(__filename);

function detectBrowser() {
  const ua = navigator.userAgent;
  let type: "chrome" | "safari" | "firefox" | "other" = "other";
  let version = 0;

  const chromeMatch = navigator.userAgent.match(/Chrome\/(\d+)\./);
  const chromeVersion = chromeMatch ? parseInt(chromeMatch[1] ?? "", 10) : 0;
  const isChrome = chromeVersion !== 0;

  // Chrome检测
  // const chromeMatch = ua.match(/Chrome\/(\d+)/);
  // if (chromeMatch && !/Edge|Edg|OPR/.test(ua)) {
  //   type = "chrome";
  //   version = parseInt(chromeMatch[1] ?? "0", 10); // 添加默认值
  // }
  if (isChrome) {
    type = "chrome";
    version = chromeVersion;
  }
  // Safari检测
  else if (ua.includes("Safari")) {
    const safariVersionMatch = ua.match(/Version\/(\d+)/);
    if (safariVersionMatch) {
      type = "safari";
      version = parseInt(safariVersionMatch[1] ?? "0", 10);
    }
  }
  // Firefox检测
  else if (ua.match(/Firefox\/(\d+)/)) {
    const firefoxMatch = ua.match(/Firefox\/(\d+)/);
    if (firefoxMatch) {
      type = "firefox";
      version = parseInt(firefoxMatch[1] ?? "0", 10);
    }
  }

  return { type, version };
}
function LogAfterRender(props: React.PropsWithChildren): React.JSX.Element {
  useEffect(() => {
    // Integration tests look for this console log to indicate the app has rendered once
    // We use console.debug to bypass our logging library which hides some log levels in prod builds
    console.debug("App rendered");
  }, []);
  return <>{props.children}</>;
}

export type MainParams = {
  dataSources?: IDataSourceFactory[];
  extraProviders?: React.JSX.Element[];
  rootElement?: React.JSX.Element;
};

export async function main(getParams: () => Promise<MainParams> = async () => ({})): Promise<void> {
  log.debug("initializing");

  window.onerror = (...args) => {
    console.error(...args);
  };

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("missing #root element");
  }

  const browserInfo = detectBrowser();
  const canRender = canRenderApp();
  const banner = (
    <CompatibilityBanner
      browserType={browserInfo.type}
      currentVersion={browserInfo.version}
      isDismissable={true}
    />
  );

  if (!canRender) {
    const root = createRoot(rootEl);
    root.render(
      <LogAfterRender>
        <CssBaseline>{banner}</CssBaseline>
      </LogAfterRender>,
    );
    return;
  }

  // Use an async import to delay loading the majority of suite-base code until the CompatibilityBanner
  // can be displayed.
  const { installDevtoolsFormatters, overwriteFetch, waitForFonts, initI18n, StudioApp } =
    await import("@lichtblick/suite-base");
  installDevtoolsFormatters();
  overwriteFetch();
  // consider moving waitForFonts into App to display an app loading screen
  await waitForFonts();
  await initI18n();

  const { WebRoot } = await import("./WebRoot");
  const params = await getParams();
  const rootElement = params.rootElement ?? (
    <WebRoot extraProviders={params.extraProviders} dataSources={params.dataSources}>
      <StudioApp />
    </WebRoot>
  );

  const root = createRoot(rootEl);
  root.render(
    <LogAfterRender>
      {banner}
      {rootElement}
    </LogAfterRender>,
  );
}
