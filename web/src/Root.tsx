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

import LocalStorageAppConfigurationProvider from "./components/LocalStorageAppConfigurationProvider";
import LocalStorageLayoutCacheProvider from "./components/LocalStorageLayoutCacheProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export default function Root(): JSX.Element {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS 1",
      type: "ros1-socket",
    },
    {
      name: "Rosbridge (WebSocket)",
      type: "ros-ws",
    },
    {
      name: "ROS 1 Bag File (local)",
      type: "ros1-local-bagfile",
    },
    {
      name: "ROS 1 Bag File (HTTP)",
      type: "ros1-remote-bagfile",
    },
    {
      name: "ROS 2 Bag Folder (local)",
      type: "ros2-folder",
    },
  ];

  const providers = [
    /* eslint-disable react/jsx-key */
    <StudioToastProvider />,
    <LocalStorageAppConfigurationProvider />,
    <LocalStorageLayoutCacheProvider />,
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
