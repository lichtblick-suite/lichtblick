// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement } from "react";

import {
  App,
  ErrorBoundary,
  MultiProvider,
  PlayerSourceDefinition,
  ThemeProvider,
  UserProfileLocalStorageProvider,
} from "@foxglove/studio-base";

import AppConfigurationProvider from "./components/AppConfigurationProvider";
import NoOpLayoutStorageProvider from "./components/NoOpLayoutStorageProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "fixme"; //https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export default function Root(): ReactElement {
  const playerSources: PlayerSourceDefinition[] = [
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
    <AppConfigurationProvider />,
    <NoOpLayoutStorageProvider />,
    <UserProfileLocalStorageProvider />,
    <ExtensionLoaderProvider />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <MultiProvider providers={providers}>
          <App demoBagUrl={DEMO_BAG_URL} availableSources={playerSources} />
        </MultiProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
