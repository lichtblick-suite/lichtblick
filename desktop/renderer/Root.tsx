// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement, useMemo } from "react";

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
  ConsoleApiCurrentUserProvider,
  ConsoleApiRemoteLayoutStorageProvider,
} from "@foxglove/studio-base";

import { Desktop } from "../common/types";
import NativeAppMenuProvider from "./components/NativeAppMenuProvider";
import NativeStorageAppConfigurationProvider from "./components/NativeStorageAppConfigurationProvider";
import NativeStorageLayoutStorageProvider from "./components/NativeStorageLayoutStorageProvider";
import NativeWindowProvider from "./components/NativeWindowProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;

export default function Root(): ReactElement {
  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS 1",
      type: "ros1-socket",
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
    },
  ];

  const api = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL!), []);

  const providers = [
    /* eslint-disable react/jsx-key */
    <NativeStorageAppConfigurationProvider />,
    <ConsoleApiContext.Provider value={api} />,
    <ConsoleApiCurrentUserProvider />,
    <ConsoleApiRemoteLayoutStorageProvider />,
    <StudioToastProvider />,
    <NativeStorageLayoutStorageProvider />,
    <NativeAppMenuProvider />,
    <NativeWindowProvider />,
    <UserProfileLocalStorageProvider />,
    <ExtensionLoaderProvider />,
    /* eslint-enable react/jsx-key */
  ];

  const deepLinks = useMemo(() => desktopBridge.getDeepLinks(), []);

  return (
    <ThemeProvider>
      <GlobalCss />
      <CssBaseline>
        <ErrorBoundary>
          <MultiProvider providers={providers}>
            <App demoBagUrl={DEMO_BAG_URL} deepLinks={deepLinks} availableSources={playerSources} />
          </MultiProvider>
        </ErrorBoundary>
      </CssBaseline>
    </ThemeProvider>
  );
}
