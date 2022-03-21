// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";
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
  AppSetting,
  useAppConfigurationValue,
  Ros1LocalBagDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  Ros1RemoteBagDataSourceFactory,
  FoxgloveDataPlatformDataSourceFactory,
  FoxgloveWebSocketDataSourceFactory,
  UlogLocalDataSourceFactory,
  McapLocalDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  AppConfiguration,
  AppConfigurationContext,
  McapRemoteDataSourceFactory,
} from "@foxglove/studio-base";

import ConsoleApiCookieUserProvider from "./components/ConsoleApiCookieCurrentUserProvider";
import LocalStorageLayoutStorageProvider from "./components/LocalStorageLayoutStorageProvider";
import Ros1UnavailableDataSourceFactory from "./dataSources/Ros1UnavailableDataSourceFactory";
import Ros2UnavailableDataSourceFactory from "./dataSources/Ros2UnavailableDataSourceFactory";
import VelodyneUnavailableDataSourceFactory from "./dataSources/VelodyneUnavailableDataSourceFactory";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";

// useAppConfiguration requires the AppConfigurationContext which is setup in Root
// AppWrapper is used to make a functional component so we can use the context
function AppWrapper() {
  const [useIterablePlayer = false] = useAppConfigurationValue<boolean>(
    AppSetting.EXPERIMENTAL_BAG_PLAYER,
  );

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new Ros1UnavailableDataSourceFactory(),
      new Ros1LocalBagDataSourceFactory({ useIterablePlayer }),
      new Ros1RemoteBagDataSourceFactory({ useIterablePlayer }),
      new Ros2UnavailableDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new FoxgloveWebSocketDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new VelodyneUnavailableDataSourceFactory(),
      new FoxgloveDataPlatformDataSourceFactory(),
      new SampleNuscenesDataSourceFactory({ useIterablePlayer }),
      new McapLocalDataSourceFactory(),
      new McapRemoteDataSourceFactory(),
    ];

    return sources;
  }, [useIterablePlayer]);

  return <App availableSources={dataSources} deepLinks={[window.location.href]} />;
}

function ColorSchemeThemeProvider({ children }: React.PropsWithChildren<unknown>): JSX.Element {
  const [colorScheme = "dark"] = useAppConfigurationValue<string>(AppSetting.COLOR_SCHEME);
  const systemSetting = useMedia("(prefers-color-scheme: dark)");
  const isDark = colorScheme === "dark" || (colorScheme === "system" && systemSetting);
  return <ThemeProvider isDark={isDark}>{children}</ThemeProvider>;
}

export function Root({ appConfiguration }: { appConfiguration: AppConfiguration }): JSX.Element {
  const api = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL!), []);

  const providers = [
    /* eslint-disable react/jsx-key */
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
    <AppConfigurationContext.Provider value={appConfiguration}>
      <ColorSchemeThemeProvider>
        <GlobalCss />
        <CssBaseline>
          <ErrorBoundary>
            <MultiProvider providers={providers}>
              <AppWrapper />
            </MultiProvider>
          </ErrorBoundary>
        </CssBaseline>
      </ColorSchemeThemeProvider>
    </AppConfigurationContext.Provider>
  );
}
