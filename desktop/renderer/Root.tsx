// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement, useMemo } from "react";
import { useMedia } from "react-use";

import {
  App,
  ErrorBoundary,
  MultiProvider,
  IDataSourceFactory,
  ThemeProvider,
  UserProfileLocalStorageProvider,
  StudioToastProvider,
  CssBaseline,
  GlobalCss,
  ConsoleApi,
  ConsoleApiContext,
  ConsoleApiRemoteLayoutStorageProvider,
  Ros1LocalBagDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  VelodyneDataSourceFactory,
  Ros1RemoteBagDataSourceFactory,
  Ros1SocketDataSourceFactory,
  Ros2SocketDataSourceFactory,
  FoxgloveDataPlatformDataSourceFactory,
  FoxgloveWebSocketDataSourceFactory,
  UlogLocalDataSourceFactory,
  McapLocalDataSourceFactory,
  useAppConfigurationValue,
  AppSetting,
} from "@foxglove/studio-base";

import { Desktop } from "../common/types";
import ConsoleApiCurrentUserProvider from "./components/ConsoleApiCurrentUserProvider";
import NativeAppMenuProvider from "./components/NativeAppMenuProvider";
import NativeColorSchemeAdapter from "./components/NativeColorSchemeAdapter";
import NativeStorageAppConfigurationProvider from "./components/NativeStorageAppConfigurationProvider";
import NativeStorageLayoutStorageProvider from "./components/NativeStorageLayoutStorageProvider";
import NativeWindowProvider from "./components/NativeWindowProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;

// useAppConfiguration requires the AppConfigurationContext which is setup in Root
// AppWrapper is used to make a functional component so we can use the context
function AppWrapper() {
  const [enableMcapDataSource = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_MCAP_DATA_SOURCE,
  );
  const [enableWebSocketDataSource = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_WEBSOCKET_DATA_SOURCE,
  );
  const deepLinks = useMemo(() => desktopBridge.getDeepLinks(), []);

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new Ros1SocketDataSourceFactory(),
      new Ros1LocalBagDataSourceFactory(),
      new Ros1RemoteBagDataSourceFactory(),
      new Ros2SocketDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new VelodyneDataSourceFactory(),

      new FoxgloveDataPlatformDataSourceFactory(),
    ];

    if (enableWebSocketDataSource) {
      sources.unshift(new FoxgloveWebSocketDataSourceFactory());
    }
    if (enableMcapDataSource) {
      sources.push(new McapLocalDataSourceFactory());
    }

    return sources;
  }, [enableMcapDataSource, enableWebSocketDataSource]);

  return <App demoBagUrl={DEMO_BAG_URL} deepLinks={deepLinks} availableSources={dataSources} />;
}

export default function Root(): ReactElement {
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

  // In Electron, the app theme setting is used to set `nativeTheme.themeSource`, which Chromium
  // uses to inform the prefers-color-scheme query, so we don't need to read the app setting here.
  const isDark = useMedia("(prefers-color-scheme: dark)");

  return (
    <ThemeProvider isDark={isDark}>
      <GlobalCss />
      <CssBaseline>
        <ErrorBoundary>
          <MultiProvider providers={providers}>
            <NativeColorSchemeAdapter />
            <AppWrapper />
          </MultiProvider>
        </ErrorBoundary>
      </CssBaseline>
    </ThemeProvider>
  );
}
