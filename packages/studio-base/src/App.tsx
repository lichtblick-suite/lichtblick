// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Suspense, useMemo, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Workspace from "@foxglove/studio-base/Workspace";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import { NativeFileMenuPlayerSelection } from "@foxglove/studio-base/components/NativeFileMenuPlayerSelection";
import PlayerManager from "@foxglove/studio-base/components/PlayerManager";
import SendNotificationToastAdapter from "@foxglove/studio-base/components/SendNotificationToastAdapter";
import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import { AssetsProvider } from "@foxglove/studio-base/context/AssetsContext";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import { HoverValueProvider } from "@foxglove/studio-base/context/HoverValueContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { PlayerSourceDefinition } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { UserNodeStateProvider } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import ConsoleApiLayoutStorageProvider from "@foxglove/studio-base/providers/ConsoleApiLayoutStorageProvider";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import CurrentUserProvider from "@foxglove/studio-base/providers/CurrentUserProvider";
import ExtensionMarketplaceProvider from "@foxglove/studio-base/providers/ExtensionMarketplaceProvider";
import ExtensionRegistryProvider from "@foxglove/studio-base/providers/ExtensionRegistryProvider";
import PanelCatalogProvider from "@foxglove/studio-base/providers/PanelCatalogProvider";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";
import URDFAssetLoader from "@foxglove/studio-base/services/URDFAssetLoader";

type AppProps = {
  /**
   * Set to true to force loading the welcome layout for demo mode. Normally the demo is only shown
   * on first launch and not subsequent launches.
   */
  loadWelcomeLayout?: boolean;
  availableSources: PlayerSourceDefinition[];
  demoBagUrl?: string;
  deepLinks?: string[];
  onFullscreenToggle?: () => void;
};

export default function App(props: AppProps): JSX.Element {
  const [assetLoaders] = useState(() => [new URDFAssetLoader()]);

  const api = useMemo(() => {
    return new ConsoleApi(process.env.FOXGLOVE_API_URL!);
  }, []);

  const [useFakeRemoteLayoutStorage = false] = useAppConfigurationValue<boolean>(
    AppSetting.FAKE_REMOTE_LAYOUTS,
  );

  const providers = [
    /* eslint-disable react/jsx-key */
    <AnalyticsProvider />,
    <ConsoleApiContext.Provider value={api} />,
    <CurrentUserProvider />,
    !useFakeRemoteLayoutStorage && <ConsoleApiLayoutStorageProvider />,
    <ModalHost />, // render modal elements inside the ThemeProvider
    <AssetsProvider loaders={assetLoaders} />,
    <HoverValueProvider />,
    <UserNodeStateProvider />,
    <CurrentLayoutProvider />,
    <ExtensionMarketplaceProvider />,
    <ExtensionRegistryProvider />,
    <PlayerManager playerSources={props.availableSources} />,
    /* eslint-enable react/jsx-key */
  ].filter((x): x is JSX.Element => x !== false);

  return (
    <MultiProvider providers={providers}>
      <SendNotificationToastAdapter />
      <NativeFileMenuPlayerSelection />
      <DndProvider backend={HTML5Backend}>
        <Suspense fallback={<></>}>
          <PanelCatalogProvider>
            <Workspace
              loadWelcomeLayout={props.loadWelcomeLayout}
              demoBagUrl={props.demoBagUrl}
              deepLinks={props.deepLinks}
              onToolbarDoubleClick={props.onFullscreenToggle}
            />
          </PanelCatalogProvider>
        </Suspense>
      </DndProvider>
    </MultiProvider>
  );
}
