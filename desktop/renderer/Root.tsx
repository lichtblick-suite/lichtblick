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
  UlogLocalDataSourceFactory,
  useAppConfigurationValue,
  AppSetting,
} from "@foxglove/studio-base";

import { Desktop } from "../common/types";
import ConsoleApiCurrentUserProvider from "./components/ConsoleApiCurrentUserProvider";
import NativeAppMenuProvider from "./components/NativeAppMenuProvider";
import NativeStorageAppConfigurationProvider from "./components/NativeStorageAppConfigurationProvider";
import NativeStorageLayoutStorageProvider from "./components/NativeStorageLayoutStorageProvider";
import NativeWindowProvider from "./components/NativeWindowProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;

const dataSources: IDataSourceFactory[] = [
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

function ColorSchemeThemeProvider({ children }: React.PropsWithChildren<unknown>): JSX.Element {
  const [colorScheme = "system"] = useAppConfigurationValue<string>(AppSetting.COLOR_SCHEME);
  const systemSetting = useMedia("(prefers-color-scheme: dark)");
  const isDark = colorScheme === "dark" || (colorScheme === "system" && systemSetting);
  return <ThemeProvider isDark={isDark}>{children}</ThemeProvider>;
}

export default function Root(): ReactElement {
  const api = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL!), []);

  const providers = [
    /* eslint-disable react/jsx-key */
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
    <NativeStorageAppConfigurationProvider>
      <ColorSchemeThemeProvider>
        <GlobalCss />
        <CssBaseline>
          <ErrorBoundary>
            <MultiProvider providers={providers}>
              <App demoBagUrl={DEMO_BAG_URL} deepLinks={deepLinks} availableSources={dataSources} />
            </MultiProvider>
          </ErrorBoundary>
        </CssBaseline>
      </ColorSchemeThemeProvider>
    </NativeStorageAppConfigurationProvider>
  );
}
