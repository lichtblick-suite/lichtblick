// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useEffect, useState } from "react";

import {
  App,
  AppSetting,
  ConsoleApi,
  FoxgloveDataPlatformDataSourceFactory,
  FoxgloveWebSocketDataSourceFactory,
  GlobalCss,
  IAppConfiguration,
  IDataSourceFactory,
  IdbExtensionLoader,
  McapLocalDataSourceFactory,
  McapRemoteDataSourceFactory,
  Ros1LocalBagDataSourceFactory,
  Ros1RemoteBagDataSourceFactory,
  Ros1SocketDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  Ros2SocketDataSourceFactory,
  RosbridgeDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  UlogLocalDataSourceFactory,
  VelodyneDataSourceFactory,
} from "@foxglove/studio-base";

import { Desktop, NativeMenuBridge, Storage } from "../common/types";
import { DesktopExtensionLoader } from "./services/DesktopExtensionLoader";
import { NativeAppMenu } from "./services/NativeAppMenu";
import NativeStorageLayoutStorage from "./services/NativeStorageLayoutStorage";
import { NativeWindow } from "./services/NativeWindow";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;
const storageBridge = (global as unknown as { storageBridge?: Storage }).storageBridge;
const menuBridge = (global as { menuBridge?: NativeMenuBridge }).menuBridge;

export default function Root({
  appConfiguration,
}: {
  appConfiguration: IAppConfiguration;
}): JSX.Element {
  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new RosbridgeDataSourceFactory(),
      new FoxgloveWebSocketDataSourceFactory(),
      new Ros1SocketDataSourceFactory(),
      new Ros1LocalBagDataSourceFactory(),
      new Ros1RemoteBagDataSourceFactory(),
      new Ros2SocketDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new VelodyneDataSourceFactory(),
      new FoxgloveDataPlatformDataSourceFactory(),
      new SampleNuscenesDataSourceFactory(),
      new McapLocalDataSourceFactory(),
      new McapRemoteDataSourceFactory(),
    ];

    return sources;
  }, []);

  if (!storageBridge) {
    throw new Error("storageBridge is missing");
  }

  useEffect(() => {
    const handler = () => {
      void desktopBridge.updateNativeColorScheme();
    };

    appConfiguration.addChangeListener(AppSetting.COLOR_SCHEME, handler);
    return () => {
      appConfiguration.removeChangeListener(AppSetting.COLOR_SCHEME, handler);
    };
  }, [appConfiguration]);

  const layoutStorage = useMemo(() => new NativeStorageLayoutStorage(storageBridge), []);
  const [extensionLoaders] = useState(() => [
    new IdbExtensionLoader("org"),
    new DesktopExtensionLoader(desktopBridge),
  ]);
  const consoleApi = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL ?? ""), []);
  const nativeAppMenu = useMemo(() => new NativeAppMenu(menuBridge), []);
  const nativeWindow = useMemo(() => new NativeWindow(desktopBridge), []);

  // App url state in window.location will represent the user's current session state
  // better than the initial deep link so we prioritize the current window.location
  // url for startup state. This persists state across user-initiated refreshes.
  const [deepLinks] = useState(() => {
    // We treat presence of the `ds` or `layoutId` params as indicative of active state.
    const windowUrl = new URL(window.location.href);
    const hasActiveURLState =
      windowUrl.searchParams.has("ds") || windowUrl.searchParams.has("layoutId");
    return hasActiveURLState ? [window.location.href] : desktopBridge.getDeepLinks();
  });

  return (
    <>
      <GlobalCss />
      <App
        enableDialogAuth
        deepLinks={deepLinks}
        dataSources={dataSources}
        appConfiguration={appConfiguration}
        consoleApi={consoleApi}
        layoutStorage={layoutStorage}
        extensionLoaders={extensionLoaders}
        nativeAppMenu={nativeAppMenu}
        nativeWindow={nativeWindow}
      />
    </>
  );
}
