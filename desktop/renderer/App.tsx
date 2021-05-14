// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ReactElement, useState, Suspense } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider as ReduxProvider } from "react-redux";

import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
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
import ThemeProvider from "@foxglove-studio/app/theme/ThemeProvider";

import NativeAppMenuProvider from "./components/NativeAppMenuProvider";
import NativeStorageAppConfigurationProvider from "./components/NativeStorageAppConfigurationProvider";
import NativeStorageLayoutStorageProvider from "./components/NativeStorageLayoutStorageProvider";

const BuiltinPanelCatalogProvider = React.lazy(
  () => import("@foxglove-studio/app/context/BuiltinPanelCatalogProvider"),
);

const Workspace = React.lazy(() => import("@foxglove-studio/app/Workspace"));

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export default function App(): ReactElement {
  const globalStore = getGlobalStore();

  const playerSources: PlayerSourceDefinition[] = [
    {
      name: "ROS",
      type: "ros1-core",
    },
    {
      name: "Rosbridge (WebSocket)",
      type: "ws",
    },
    {
      name: "Bag File (local)",
      type: "file",
    },
    {
      name: "Bag File (HTTP)",
      type: "http",
    },
  ];

  const [assetLoaders] = useState(() => [new URDFAssetLoader()]);

  const providers = [
    /* eslint-disable react/jsx-key */
    <NativeStorageAppConfigurationProvider />,
    <NativeStorageLayoutStorageProvider />,
    <ThemeProvider />,
    <ModalHost />, // render modal elements inside the ThemeProvider
    <StudioToastProvider />,
    <ReduxProvider store={globalStore} />,
    <AnalyticsProvider />,
    <PlayerManager playerSources={playerSources} />,
    <AssetsProvider loaders={assetLoaders} />,
    <NativeAppMenuProvider />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <ErrorBoundary>
      <MultiProvider providers={providers}>
        <LayoutStorageReduxAdapter />
        <NativeFileMenuPlayerSelection />
        <DndProvider backend={HTML5Backend}>
          <Suspense fallback={<></>}>
            <BuiltinPanelCatalogProvider>
              <Workspace demoBagUrl={DEMO_BAG_URL} />
            </BuiltinPanelCatalogProvider>
          </Suspense>
        </DndProvider>
      </MultiProvider>
    </ErrorBoundary>
  );
}
