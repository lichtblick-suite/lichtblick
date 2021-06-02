// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { FirebaseOptions } from "@firebase/app";
import { useMemo } from "react";

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

import AppConfigurationProvider from "./components/AppConfigurationProvider";
import NoOpLayoutStorageProvider from "./components/NoOpLayoutStorageProvider";
import ExtensionLoaderProvider from "./providers/ExtensionLoaderProvider";
import FirebasePopupAuthProvider from "./providers/FirebasePopupAuthProvider";

const DEMO_BAG_URL = "https://storage.googleapis.com/foxglove-public-assets/demo.bag";

export default function Root(): JSX.Element {
  const playerSources: PlayerSourceDefinition[] = [
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
    <AppConfigurationProvider />,
    <NoOpLayoutStorageProvider />,
    <UserProfileLocalStorageProvider />,
    <FirebaseAppProvider config={firebaseConfig} />,
    <FirebasePopupAuthProvider />,
    <ExtensionLoaderProvider />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <MultiProvider providers={providers}>
          <App demoBagUrl={DEMO_BAG_URL} availableSources={playerSources} />
        </MultiProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
