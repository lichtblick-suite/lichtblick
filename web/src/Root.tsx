// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link } from "@fluentui/react";

import {
  App,
  ErrorBoundary,
  MultiProvider,
  PlayerSourceDefinition,
  ThemeProvider,
  UserProfileLocalStorageProvider,
  StudioToastProvider,
  CssBaseline,
  GlobalCss,
} from "@foxglove/studio-base";

import LocalStorageAppConfigurationProvider from "./components/LocalStorageAppConfigurationProvider";
import LocalStorageLayoutCacheProvider from "./components/LocalStorageLayoutCacheProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export function Root({ loadWelcomeLayout }: { loadWelcomeLayout: boolean }): JSX.Element {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS 1",
      type: "ros1-socket",
      disabledReason: (
        <>
          ROS 1 Native connections are only available in our desktop app.&nbsp;
          <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
            Download it here.
          </Link>
        </>
      ),
    },
    {
      name: "ROS 1 Rosbridge (WebSocket)",
      type: "ros1-rosbridge-websocket",
    },
    {
      name: "ROS 2 Rosbridge (WebSocket)",
      type: "ros2-rosbridge-websocket",
    },
    {
      name: "ROS 1 Bag (local)",
      type: "ros1-local-bagfile",
    },
    {
      name: "ROS 1 Bag (HTTP)",
      type: "ros1-remote-bagfile",
    },
    {
      name: "ROS 2 Bag (local)",
      type: "ros2-local-bagfile",
    },
    {
      name: "Velodyne LIDAR",
      type: "velodyne-device",
      disabledReason: (
        <>
          Velodyne connections are only available in our desktop app.&nbsp;
          <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
            Download it here.
          </Link>
        </>
      ),
    },
  ];

  const providers = [
    /* eslint-disable react/jsx-key */
    <StudioToastProvider />,
    <LocalStorageAppConfigurationProvider />,
    <LocalStorageLayoutCacheProvider />,
    <UserProfileLocalStorageProvider />,
    <ExtensionLoaderProvider />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <ThemeProvider>
      <GlobalCss />
      <CssBaseline>
        <ErrorBoundary>
          <MultiProvider providers={providers}>
            <App
              loadWelcomeLayout={loadWelcomeLayout}
              demoBagUrl={DEMO_BAG_URL}
              availableSources={playerSources}
            />
          </MultiProvider>
        </ErrorBoundary>
      </CssBaseline>
    </ThemeProvider>
  );
}
