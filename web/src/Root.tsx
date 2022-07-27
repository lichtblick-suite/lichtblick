// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState } from "react";

import {
  IDataSourceFactory,
  AppSetting,
  Ros1LocalBagDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  Ros1RemoteBagDataSourceFactory,
  FoxgloveDataPlatformDataSourceFactory,
  FoxgloveWebSocketDataSourceFactory,
  UlogLocalDataSourceFactory,
  McapLocalDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  IAppConfiguration,
  IdbExtensionLoader,
  McapRemoteDataSourceFactory,
  App,
  ConsoleApi,
} from "@foxglove/studio-base";

import Ros1UnavailableDataSourceFactory from "./dataSources/Ros1UnavailableDataSourceFactory";
import Ros2UnavailableDataSourceFactory from "./dataSources/Ros2UnavailableDataSourceFactory";
import VelodyneUnavailableDataSourceFactory from "./dataSources/VelodyneUnavailableDataSourceFactory";
import { IdbLayoutStorage } from "./services/IdbLayoutStorage";

export function Root({ appConfiguration }: { appConfiguration: IAppConfiguration }): JSX.Element {
  const enableExperimentalBagPlayer: boolean =
    (appConfiguration.get(AppSetting.EXPERIMENTAL_BAG_PLAYER) as boolean | undefined) ?? false;
  const enableExperimentalDataPlatformPlayer: boolean =
    (appConfiguration.get(AppSetting.EXPERIMENTAL_DATA_PLATFORM_PLAYER) as boolean | undefined) ??
    false;
  const enableExperimentalMcapPlayer: boolean =
    (appConfiguration.get(AppSetting.EXPERIMENTAL_MCAP_PLAYER) as boolean | undefined) ?? false;

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new Ros1UnavailableDataSourceFactory(),
      new Ros1LocalBagDataSourceFactory({ useIterablePlayer: enableExperimentalBagPlayer }),
      new Ros1RemoteBagDataSourceFactory({ useIterablePlayer: enableExperimentalBagPlayer }),
      new Ros2UnavailableDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new FoxgloveWebSocketDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new VelodyneUnavailableDataSourceFactory(),
      new FoxgloveDataPlatformDataSourceFactory({
        useIterablePlayer: enableExperimentalDataPlatformPlayer,
      }),
      new SampleNuscenesDataSourceFactory({ useIterablePlayer: enableExperimentalBagPlayer }),
      new McapLocalDataSourceFactory({ useIterablePlayer: enableExperimentalMcapPlayer }),
      new McapRemoteDataSourceFactory({ useIterablePlayer: enableExperimentalMcapPlayer }),
    ];

    return sources;
  }, [
    enableExperimentalBagPlayer,
    enableExperimentalDataPlatformPlayer,
    enableExperimentalMcapPlayer,
  ]);

  const layoutStorage = useMemo(() => new IdbLayoutStorage(), []);
  const [extensionLoaders] = useState(() => [
    new IdbExtensionLoader("org"),
    new IdbExtensionLoader("local"),
  ]);
  const consoleApi = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL!), []);

  // Enable dialog auth in development since using cookie auth does not work between
  // localhost and the hosted dev deployment due to browser cookie/host security.
  const enableDialogAuth = process.env.NODE_ENV === "development";

  return (
    <App
      enableDialogAuth={enableDialogAuth}
      enableLaunchPreferenceScreen
      deepLinks={[window.location.href]}
      dataSources={dataSources}
      appConfiguration={appConfiguration}
      layoutStorage={layoutStorage}
      consoleApi={consoleApi}
      extensionLoaders={extensionLoaders}
    />
  );
}
