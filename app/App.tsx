// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Suspense, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider as ReduxProvider } from "react-redux";

import Workspace from "@foxglove/studio-base/Workspace";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import { NativeFileMenuPlayerSelection } from "@foxglove/studio-base/components/NativeFileMenuPlayerSelection";
import PlayerManager from "@foxglove/studio-base/components/PlayerManager";
import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import { AssetsProvider } from "@foxglove/studio-base/context/AssetContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { PlayerSourceDefinition } from "@foxglove/studio-base/context/PlayerSelectionContext";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import ExtensionRegistryProvider from "@foxglove/studio-base/providers/ExtensionRegistryProvider";
import URDFAssetLoader from "@foxglove/studio-base/services/URDFAssetLoader";
import getGlobalStore from "@foxglove/studio-base/store/getGlobalStore";

const BuiltinPanelCatalogProvider = React.lazy(
  () => import("@foxglove/studio-base/context/BuiltinPanelCatalogProvider"),
);

type AppProps = {
  availableSources: PlayerSourceDefinition[];
  demoBagUrl?: string;
  deepLinks?: string[];
  onFullscreenToggle?: () => void;
};

export default function App(props: AppProps): JSX.Element {
  const globalStore = getGlobalStore();

  const [assetLoaders] = useState(() => [new URDFAssetLoader()]);

  const providers = [
    /* eslint-disable react/jsx-key */
    <AnalyticsProvider />,
    <ModalHost />, // render modal elements inside the ThemeProvider
    <AssetsProvider loaders={assetLoaders} />,
    <ReduxProvider store={globalStore} />,
    <CurrentLayoutProvider />,
    <ExtensionRegistryProvider />,
    <PlayerManager playerSources={props.availableSources} />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <MultiProvider providers={providers}>
      <NativeFileMenuPlayerSelection />
      <DndProvider backend={HTML5Backend}>
        <Suspense fallback={<></>}>
          <BuiltinPanelCatalogProvider>
            <Workspace
              demoBagUrl={props.demoBagUrl}
              deepLinks={props.deepLinks}
              onToolbarDoubleClick={props.onFullscreenToggle}
            />
          </BuiltinPanelCatalogProvider>
        </Suspense>
      </DndProvider>
    </MultiProvider>
  );
}
