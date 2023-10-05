// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Fragment, Suspense, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import GlobalCss from "@foxglove/studio-base/components/GlobalCss";
import EventsProvider from "@foxglove/studio-base/providers/EventsProvider";
import ProblemsContextProvider from "@foxglove/studio-base/providers/ProblemsContextProvider";
import { StudioLogsSettingsProvider } from "@foxglove/studio-base/providers/StudioLogsSettingsProvider";
import TimelineInteractionStateProvider from "@foxglove/studio-base/providers/TimelineInteractionStateProvider";

import Workspace from "./Workspace";
import { CustomWindowControlsProps } from "./components/AppBar/CustomWindowControls";
import { ColorSchemeThemeProvider } from "./components/ColorSchemeThemeProvider";
import CssBaseline from "./components/CssBaseline";
import DocumentTitleAdapter from "./components/DocumentTitleAdapter";
import ErrorBoundary from "./components/ErrorBoundary";
import MultiProvider from "./components/MultiProvider";
import PlayerManager from "./components/PlayerManager";
import SendNotificationToastAdapter from "./components/SendNotificationToastAdapter";
import StudioToastProvider from "./components/StudioToastProvider";
import AppConfigurationContext, { IAppConfiguration } from "./context/AppConfigurationContext";
import NativeAppMenuContext, { INativeAppMenu } from "./context/NativeAppMenuContext";
import NativeWindowContext, { INativeWindow } from "./context/NativeWindowContext";
import { IDataSourceFactory } from "./context/PlayerSelectionContext";
import { UserScriptStateProvider } from "./context/UserScriptStateContext";
import CurrentLayoutProvider from "./providers/CurrentLayoutProvider";
import ExtensionCatalogProvider from "./providers/ExtensionCatalogProvider";
import ExtensionMarketplaceProvider from "./providers/ExtensionMarketplaceProvider";
import PanelCatalogProvider from "./providers/PanelCatalogProvider";
import { LaunchPreference } from "./screens/LaunchPreference";
import { ExtensionLoader } from "./services/ExtensionLoader";

type AppProps = CustomWindowControlsProps & {
  deepLinks: string[];
  appConfiguration: IAppConfiguration;
  dataSources: IDataSourceFactory[];
  extensionLoaders: readonly ExtensionLoader[];
  nativeAppMenu?: INativeAppMenu;
  nativeWindow?: INativeWindow;
  enableLaunchPreferenceScreen?: boolean;
  enableGlobalCss?: boolean;
  appBarLeftInset?: number;
  extraProviders?: JSX.Element[];
  onAppBarDoubleClick?: () => void;
};

// Suppress context menu for the entire app except on inputs & textareas.
function contextMenuHandler(event: MouseEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  event.preventDefault();
  return false;
}

export function App(props: AppProps): JSX.Element {
  const {
    appConfiguration,
    dataSources,
    extensionLoaders,
    nativeAppMenu,
    nativeWindow,
    deepLinks,
    enableLaunchPreferenceScreen,
    enableGlobalCss = false,
    extraProviders,
  } = props;

  const providers = [
    /* eslint-disable react/jsx-key */
    <TimelineInteractionStateProvider />,
    <UserScriptStateProvider />,
    <CurrentLayoutProvider />,
    <ExtensionMarketplaceProvider />,
    <ExtensionCatalogProvider loaders={extensionLoaders} />,
    <PlayerManager playerSources={dataSources} />,
    <EventsProvider />,
    /* eslint-enable react/jsx-key */
  ];

  if (nativeAppMenu) {
    providers.push(<NativeAppMenuContext.Provider value={nativeAppMenu} />);
  }

  if (nativeWindow) {
    providers.push(<NativeWindowContext.Provider value={nativeWindow} />);
  }

  if (extraProviders) {
    providers.unshift(...extraProviders);
  }

  // The toast and logs provider comes first so they are available to all downstream providers
  providers.unshift(<StudioToastProvider />);
  providers.unshift(<StudioLogsSettingsProvider />);

  // Problems provider also must come before other, depdendent contexts.
  providers.unshift(<ProblemsContextProvider />);

  const MaybeLaunchPreference = enableLaunchPreferenceScreen === true ? LaunchPreference : Fragment;

  useEffect(() => {
    document.addEventListener("contextmenu", contextMenuHandler);
    return () => {
      document.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, []);

  return (
    <AppConfigurationContext.Provider value={appConfiguration}>
      <ColorSchemeThemeProvider>
        {enableGlobalCss && <GlobalCss />}
        <CssBaseline>
          <ErrorBoundary>
            <MaybeLaunchPreference>
              <MultiProvider providers={providers}>
                <DocumentTitleAdapter />
                <SendNotificationToastAdapter />
                <DndProvider backend={HTML5Backend}>
                  <Suspense fallback={<></>}>
                    <PanelCatalogProvider>
                      <Workspace
                        deepLinks={deepLinks}
                        appBarLeftInset={props.appBarLeftInset}
                        onAppBarDoubleClick={props.onAppBarDoubleClick}
                        showCustomWindowControls={props.showCustomWindowControls}
                        isMaximized={props.isMaximized}
                        onMinimizeWindow={props.onMinimizeWindow}
                        onMaximizeWindow={props.onMaximizeWindow}
                        onUnmaximizeWindow={props.onUnmaximizeWindow}
                        onCloseWindow={props.onCloseWindow}
                      />
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
