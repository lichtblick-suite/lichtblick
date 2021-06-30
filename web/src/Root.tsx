// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  App,
  ErrorBoundary,
  MultiProvider,
  PlayerSourceDefinition,
  ThemeProvider,
  UserProfileLocalStorageProvider,
  StudioToastProvider,
  CacheOnlyLayoutStorageProvider,
} from "@foxglove/studio-base";

import AppConfigurationProvider from "./components/AppConfigurationProvider";
import NoOpLayoutCacheProvider from "./components/NoOpLayoutCacheProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export default function Root(): JSX.Element {
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
    <StudioToastProvider />,
    <AppConfigurationProvider />,
    <NoOpLayoutCacheProvider />,
    <CacheOnlyLayoutStorageProvider />,
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
