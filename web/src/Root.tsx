// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, Text } from "@fluentui/react";
import { useMemo } from "react";

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
  ConsoleApi,
  ConsoleApiContext,
  ConsoleApiRemoteLayoutStorageProvider,
} from "@foxglove/studio-base";

import ConsoleApiCookieUserProvider from "./components/ConsoleApiCookieCurrentUserProvider";
import LocalStorageAppConfigurationProvider from "./components/LocalStorageAppConfigurationProvider";
import LocalStorageLayoutStorageProvider from "./components/LocalStorageLayoutStorageProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export function Root({ loadWelcomeLayout }: { loadWelcomeLayout: boolean }): JSX.Element {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS 1",
      type: "ros1-socket",
      disabledReason: (
        <>
          <Text block as="p">
            ROS 1 Native connections are only available in our desktop app.&nbsp;
            <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
              Download it here.
            </Link>
          </Text>
          <Text
            block
            as="p"
            styles={(_props, theme) => ({ root: { color: theme.semanticColors.disabledText } })}
          >
            Native TCP and UDP sockets are not available in a standard browser environment.
          </Text>
        </>
      ),
    },
    {
      name: "ROS 1 Rosbridge",
      type: "rosbridge-websocket",
    },
    {
      name: "ROS 1 Bag (local)",
      type: "ros1-local-bagfile",
    },
    {
      name: "ROS 1 Bag (remote)",
      type: "ros1-remote-bagfile",
    },
    {
      name: "ROS 2",
      type: "ros2-socket",
      badgeText: "beta",
      disabledReason: (
        <>
          <Text block as="p">
            ROS 2 Native connections are only available in our desktop app.&nbsp;
            <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
              Download it here.
            </Link>
          </Text>
          <Text
            block
            as="p"
            styles={(_props, theme) => ({ root: { color: theme.semanticColors.disabledText } })}
          >
            Native TCP and UDP sockets are not available in a standard browser environment.
          </Text>
        </>
      ),
    },
    {
      name: "ROS 2 Rosbridge",
      type: "rosbridge-websocket",
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
          <Text block as="p">
            Velodyne connections are only available in our desktop app.&nbsp;
            <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
              Download it here.
            </Link>
          </Text>
          <Text
            block
            as="p"
            styles={(_props, theme) => ({ root: { color: theme.semanticColors.disabledText } })}
          >
            Native TCP and UDP sockets are not available in a standard browser environment.
          </Text>
        </>
      ),
    },
  ];

  const api = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL!), []);

  const providers = [
    /* eslint-disable react/jsx-key */
    <LocalStorageAppConfigurationProvider />,
    <ConsoleApiContext.Provider value={api} />,
    <ConsoleApiCookieUserProvider />,
    <ConsoleApiRemoteLayoutStorageProvider />,
    <StudioToastProvider />,
    <LocalStorageLayoutStorageProvider />,
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
