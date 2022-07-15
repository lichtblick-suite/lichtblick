// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useState, Suspense, Fragment } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Workspace from "./Workspace";
import { ColorSchemeThemeProvider } from "./components/ColorSchemeThemeProvider";
import CssBaseline from "./components/CssBaseline";
import DocumentTitleAdapter from "./components/DocumentTitleAdapter";
import ErrorBoundary from "./components/ErrorBoundary";
import GlobalCss from "./components/GlobalCss";
import MultiProvider from "./components/MultiProvider";
import PlayerManager from "./components/PlayerManager";
import SendNotificationToastAdapter from "./components/SendNotificationToastAdapter";
import StudioToastProvider from "./components/StudioToastProvider";
import AnalyticsProvider from "./context/AnalyticsProvider";
import AppConfigurationContext, { IAppConfiguration } from "./context/AppConfigurationContext";
import { AssetsProvider } from "./context/AssetsContext";
import ConsoleApiContext from "./context/ConsoleApiContext";
import { HoverValueProvider } from "./context/HoverValueContext";
import LayoutStorageContext from "./context/LayoutStorageContext";
import ModalHost from "./context/ModalHost";
import NativeAppMenuContext, { INativeAppMenu } from "./context/NativeAppMenuContext";
import NativeWindowContext, { INativeWindow } from "./context/NativeWindowContext";
import { IDataSourceFactory } from "./context/PlayerSelectionContext";
import { UserNodeStateProvider } from "./context/UserNodeStateContext";
import { ConsoleApiCookieCurrentUserProvider } from "./providers/ConsoleApiCookieUserProvider";
import { ConsoleApiDialogCurrentUserProvider } from "./providers/ConsoleApiDialogCurrentUserProvider";
import ConsoleApiRemoteLayoutStorageProvider from "./providers/ConsoleApiRemoteLayoutStorageProvider";
import CurrentLayoutProvider from "./providers/CurrentLayoutProvider";
import ExtensionMarketplaceProvider from "./providers/ExtensionMarketplaceProvider";
import ExtensionRegistryProvider from "./providers/ExtensionRegistryProvider";
import HelpInfoProvider from "./providers/HelpInfoProvider";
import LayoutManagerProvider from "./providers/LayoutManagerProvider";
import PanelCatalogProvider from "./providers/PanelCatalogProvider";
import UserProfileLocalStorageProvider from "./providers/UserProfileLocalStorageProvider";
import { LaunchPreference } from "./screens/LaunchPreference";
import ConsoleApi from "./services/ConsoleApi";
import { ExtensionLoader } from "./services/ExtensionLoader";
import { ILayoutStorage } from "./services/ILayoutStorage";
import URDFAssetLoader from "./services/URDFAssetLoader";

type AppProps = {
  deepLinks: string[];
  appConfiguration: IAppConfiguration;
  dataSources: IDataSourceFactory[];
  consoleApi: ConsoleApi;
  layoutStorage: ILayoutStorage;
  extensionLoaders: readonly ExtensionLoader[];
  nativeAppMenu?: INativeAppMenu;
  nativeWindow?: INativeWindow;
  enableDialogAuth?: boolean;
  enableLaunchPreferenceScreen?: boolean;
};

export function App(props: AppProps): JSX.Element {
  const [assetLoaders] = useState(() => [new URDFAssetLoader()]);

  const {
    appConfiguration,
    dataSources,
    layoutStorage,
    consoleApi,
    extensionLoaders,
    nativeAppMenu,
    nativeWindow,
    enableDialogAuth,
    deepLinks,
    enableLaunchPreferenceScreen,
  } = props;

  const CurrentUserProviderComponent =
    enableDialogAuth === true
      ? ConsoleApiDialogCurrentUserProvider
      : ConsoleApiCookieCurrentUserProvider;

  const providers = [
    /* eslint-disable react/jsx-key */
    <ConsoleApiContext.Provider value={consoleApi} />,
    <CurrentUserProviderComponent />,
    <ConsoleApiRemoteLayoutStorageProvider />,
    <StudioToastProvider />,
    <LayoutStorageContext.Provider value={layoutStorage} />,
    <UserProfileLocalStorageProvider />,
    <AnalyticsProvider amplitudeApiKey={process.env.AMPLITUDE_API_KEY} />,
    <LayoutManagerProvider />,
    <ModalHost />, // render modal elements inside the ThemeProvider
    <AssetsProvider loaders={assetLoaders} />,
    <HelpInfoProvider />,
    <HoverValueProvider />,
    <UserNodeStateProvider />,
    <CurrentLayoutProvider />,
    <ExtensionMarketplaceProvider />,
    <ExtensionRegistryProvider loaders={extensionLoaders} />,
    <PlayerManager playerSources={dataSources} />,
    /* eslint-enable react/jsx-key */
  ];

  if (nativeAppMenu) {
    providers.push(<NativeAppMenuContext.Provider value={nativeAppMenu} />);
  }

  if (nativeWindow) {
    providers.push(<NativeWindowContext.Provider value={nativeWindow} />);
  }

  const MaybeLaunchPreference = enableLaunchPreferenceScreen === true ? LaunchPreference : Fragment;

  return (
    <AppConfigurationContext.Provider value={appConfiguration}>
      <ColorSchemeThemeProvider>
        <GlobalCss />
        <CssBaseline>
          <ErrorBoundary>
            <MaybeLaunchPreference>
              <MultiProvider providers={providers}>
                <DocumentTitleAdapter />
                <SendNotificationToastAdapter />
                <DndProvider backend={HTML5Backend}>
                  <Suspense fallback={<></>}>
                    <PanelCatalogProvider>
                      <Workspace deepLinks={deepLinks} />
                    </PanelCatalogProvider>
                  </Suspense>
                </DndProvider>
              </MultiProvider>
            </MaybeLaunchPreference>
          </ErrorBoundary>
        </CssBaseline>
      </ColorSchemeThemeProvider>
    </AppConfigurationContext.Provider>
  );
}
