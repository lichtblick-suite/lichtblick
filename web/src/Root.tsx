// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState } from "react";

import {
  IDataSourceFactory,
  Ros1LocalBagDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  RemoteDataSourceFactory,
  FoxgloveWebSocketDataSourceFactory,
  UlogLocalDataSourceFactory,
  McapLocalDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  IAppConfiguration,
  IdbExtensionLoader,
  App,
} from "@foxglove/studio-base";

import VelodyneUnavailableDataSourceFactory from "./dataSources/VelodyneUnavailableDataSourceFactory";
import { IdbLayoutStorage } from "./services/IdbLayoutStorage";

export function Root({ appConfiguration }: { appConfiguration: IAppConfiguration }): JSX.Element {
  const layoutStorage = useMemo(() => new IdbLayoutStorage(), []);
  const [extensionLoaders] = useState(() => [
    new IdbExtensionLoader("org"),
    new IdbExtensionLoader("local"),
  ]);

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new Ros1LocalBagDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new FoxgloveWebSocketDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new VelodyneUnavailableDataSourceFactory(),
      new SampleNuscenesDataSourceFactory(),
      new McapLocalDataSourceFactory(),
      new RemoteDataSourceFactory(),
    ];

    return sources;
  }, []);

  return (
    <>
      <App
        enableLaunchPreferenceScreen
        deepLinks={[window.location.href]}
        dataSources={dataSources}
        appConfiguration={appConfiguration}
        layoutStorage={layoutStorage}
        extensionLoaders={extensionLoaders}
        enableGlobalCss
      />
    </>
  );
}
