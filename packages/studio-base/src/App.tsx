// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Suspense, useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Workspace from "@foxglove/studio-base/Workspace";
import DocumentTitleAdapter from "@foxglove/studio-base/components/DocumentTitleAdapter";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import PlayerManager from "@foxglove/studio-base/components/PlayerManager";
import SendNotificationToastAdapter from "@foxglove/studio-base/components/SendNotificationToastAdapter";
import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import { AssetsProvider } from "@foxglove/studio-base/context/AssetsContext";
import { HoverValueProvider } from "@foxglove/studio-base/context/HoverValueContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { IDataSourceFactory } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { UserNodeStateProvider } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { useSessionStorageValue } from "@foxglove/studio-base/hooks/useSessionStorageValue";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import ExtensionMarketplaceProvider from "@foxglove/studio-base/providers/ExtensionMarketplaceProvider";
import ExtensionRegistryProvider from "@foxglove/studio-base/providers/ExtensionRegistryProvider";
import HelpInfoProvider from "@foxglove/studio-base/providers/HelpInfoProvider";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import PanelCatalogProvider from "@foxglove/studio-base/providers/PanelCatalogProvider";
import { LaunchPreferenceScreen } from "@foxglove/studio-base/screens/LaunchPreferenceScreen";
import { LaunchingInDesktopScreen } from "@foxglove/studio-base/screens/LaunchingInDesktopScreen";
import URDFAssetLoader from "@foxglove/studio-base/services/URDFAssetLoader";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

type AppProps = {
  /**
   * Set to true to force loading the welcome layout for demo mode. Normally the demo is only shown
   * on first launch and not subsequent launches.
   */
  availableSources: IDataSourceFactory[];
  deepLinks?: string[];
};

function AppContent(props: AppProps): JSX.Element {
  const [assetLoaders] = useState(() => [new URDFAssetLoader()]);
  const [_, setSessionLaunchPreference] = useSessionStorageValue(AppSetting.LAUNCH_PREFERENCE);

  // Once we've rendered the app content set a temporary, session storage preference
  // for web so that we don't inadvertently bounce the user to the web/desktop
  // session preference screen again.
  useEffect(() => {
    if (!isDesktopApp()) {
      setSessionLaunchPreference("web");
    }
  }, [setSessionLaunchPreference]);

  const providers = [
    /* eslint-disable react/jsx-key */
    <AnalyticsProvider amplitudeApiKey={process.env.AMPLITUDE_API_KEY} />,
    <LayoutManagerProvider />,
    <ModalHost />, // render modal elements inside the ThemeProvider
    <AssetsProvider loaders={assetLoaders} />,
    <HelpInfoProvider />,
    <HoverValueProvider />,
    <UserNodeStateProvider />,
    <CurrentLayoutProvider />,
    <ExtensionMarketplaceProvider />,
    <ExtensionRegistryProvider />,
    <PlayerManager playerSources={props.availableSources} />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <MultiProvider providers={providers}>
      <DocumentTitleAdapter />
      <SendNotificationToastAdapter />
      <DndProvider backend={HTML5Backend}>
        <Suspense fallback={<></>}>
          <PanelCatalogProvider>
            <Workspace deepLinks={props.deepLinks} />
          </PanelCatalogProvider>
        </Suspense>
      </DndProvider>
    </MultiProvider>
  );
}

export default function App(props: AppProps): JSX.Element {
  const isDesktop = isDesktopApp();
  const [globalLaunchPreference = "unknown"] = useAppConfigurationValue<string>(
    AppSetting.LAUNCH_PREFERENCE,
  );
  const [sessionLaunchPreference] = useSessionStorageValue(AppSetting.LAUNCH_PREFERENCE);

  // Session preferences take priority over global preferences.
  const activePreference = sessionLaunchPreference ?? globalLaunchPreference;

  if (isDesktop) {
    return <AppContent {...props} />;
  } else {
    const url = new URL(window.location.href);
    const hasParams = Array.from(url.searchParams.entries()).length > 0;
    // Ask the user in which environment they want to open this session.
    if (activePreference === "unknown" && hasParams) {
      return <LaunchPreferenceScreen />;
    } else if (activePreference === "desktop" && hasParams) {
      return <LaunchingInDesktopScreen />;
    } else {
      return <AppContent {...props} />;
    }
  }
}
