// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Suspense, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider as ReduxProvider } from "react-redux";

import Workspace from "@foxglove-studio/app/Workspace";
import LayoutStorageReduxAdapter from "@foxglove-studio/app/components/LayoutStorageReduxAdapter";
import MultiProvider from "@foxglove-studio/app/components/MultiProvider";
import { NativeFileMenuPlayerSelection } from "@foxglove-studio/app/components/NativeFileMenuPlayerSelection";
import PlayerManager from "@foxglove-studio/app/components/PlayerManager";
import StudioToastProvider from "@foxglove-studio/app/components/StudioToastProvider";
import AnalyticsProvider from "@foxglove-studio/app/context/AnalyticsProvider";
import { AssetsProvider } from "@foxglove-studio/app/context/AssetContext";
import ModalHost from "@foxglove-studio/app/context/ModalHost";
import { PlayerSourceDefinition } from "@foxglove-studio/app/context/PlayerSelectionContext";
import URDFAssetLoader from "@foxglove-studio/app/services/URDFAssetLoader";
import getGlobalStore from "@foxglove-studio/app/store/getGlobalStore";

const BuiltinPanelCatalogProvider = React.lazy(
  () => import("@foxglove-studio/app/context/BuiltinPanelCatalogProvider"),
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
    <StudioToastProvider />,
    <AssetsProvider loaders={assetLoaders} />,
    <ReduxProvider store={globalStore} />,
    <PlayerManager playerSources={props.availableSources} />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <MultiProvider providers={providers}>
      <LayoutStorageReduxAdapter />
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
