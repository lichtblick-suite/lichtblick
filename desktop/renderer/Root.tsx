// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ReactElement, useCallback, useMemo } from "react";

import {
  App,
  ErrorBoundary,
  MultiProvider,
  PlayerSourceDefinition,
  ThemeProvider,
} from "@foxglove-studio/app";

import { Desktop } from "../common/types";
import NativeAppMenuProvider from "./components/NativeAppMenuProvider";
import NativeStorageAppConfigurationProvider from "./components/NativeStorageAppConfigurationProvider";
import NativeStorageLayoutStorageProvider from "./components/NativeStorageLayoutStorageProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

const desktopBridge = (global as { desktopBridge?: Desktop }).desktopBridge;

export default function Root(): ReactElement {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS",
      type: "ros1-core",
    },
    {
      name: "Rosbridge (WebSocket)",
      type: "ws",
    },
    {
      name: "Bag File (local)",
      type: "file",
    },
    {
      name: "Bag File (HTTP)",
      type: "http",
    },
  ];

  const providers = [
    /* eslint-disable react/jsx-key */
    <NativeStorageAppConfigurationProvider />,
    <NativeStorageLayoutStorageProvider />,
    <NativeAppMenuProvider />,
    /* eslint-enable react/jsx-key */
  ];

  const deepLinks = useMemo(() => {
    return desktopBridge?.getDeepLinks() ?? [];
  }, []);

  const handleToolbarDoubleClick = useCallback(() => {
    desktopBridge?.handleToolbarDoubleClick();
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <MultiProvider providers={providers}>
          <App
            demoBagUrl={DEMO_BAG_URL}
            deepLinks={deepLinks}
            onFullscreenToggle={handleToolbarDoubleClick}
            availableSources={playerSources}
          />
        </MultiProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
