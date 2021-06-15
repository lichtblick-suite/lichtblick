// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { FirebaseOptions } from "@firebase/app";
import { ReactElement, useCallback, useMemo } from "react";

import {
  App,
  ErrorBoundary,
  MultiProvider,
  PlayerSourceDefinition,
  ThemeProvider,
  UserProfileLocalStorageProvider,
  StudioToastProvider,
} from "@foxglove/studio-base";
import { FirebaseAppProvider } from "@foxglove/studio-firebase";

import { Desktop } from "../common/types";
import NativeAppMenuProvider from "./components/NativeAppMenuProvider";
import NativeStorageAppConfigurationProvider from "./components/NativeStorageAppConfigurationProvider";
import NativeStorageLayoutCacheProvider from "./components/NativeStorageLayoutCacheProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";
import ExternalBrowserFirebaseAuthProvider from "./providers/ExternalBrowserFirebaseAuthProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;

export default function Root(): ReactElement {
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

  const firebaseConfig = useMemo(() => {
    const config = process.env.FIREBASE_CONFIG;
    if (config == undefined) {
      throw new Error("Firebase is not configured");
    }
    return JSON.parse(config) as FirebaseOptions;
  }, []);

  const providers = [
    /* eslint-disable react/jsx-key */
    <StudioToastProvider />,
    <NativeStorageAppConfigurationProvider />,
    <NativeStorageLayoutCacheProvider />,
    <NativeAppMenuProvider />,
    <UserProfileLocalStorageProvider />,
    <FirebaseAppProvider config={firebaseConfig} />,
    <ExternalBrowserFirebaseAuthProvider />,
    <ExtensionLoaderProvider />,
    /* eslint-enable react/jsx-key */
  ];

  const deepLinks = useMemo(() => desktopBridge.getDeepLinks(), []);

  const handleToolbarDoubleClick = useCallback(() => desktopBridge.handleToolbarDoubleClick(), []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <MultiProvider providers={providers}>
          <App
            demoBagUrl={DEMO_BAG_URL}
            deepLinks={deepLinks}
            onFullscreenToggle={handleToolbarDoubleClick}
            availableSources={playerSources}
          />
        </MultiProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
