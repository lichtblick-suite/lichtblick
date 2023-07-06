// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState } from "react";

import { App, IDataSourceFactory, AppSetting, LaunchPreferenceValue } from "@foxglove/studio-base";

import { McapLocalBenchmarkDataSourceFactory, SyntheticDataSourceFactory } from "./dataSources";
import { LAYOUTS } from "./layouts";
import {
  PointcloudPlayer,
  SinewavePlayer,
  TransformPlayer,
  TransformPreloadingPlayer,
} from "./players";
import { MemoryAppConfiguration } from "./services";

export function Root(): JSX.Element {
  const [appConfiguration] = useState(
    () =>
      new MemoryAppConfiguration({
        defaults: {
          [AppSetting.LAUNCH_PREFERENCE]: LaunchPreferenceValue.WEB,
          [AppSetting.MESSAGE_RATE]: 240,
        },
      }),
  );

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new McapLocalBenchmarkDataSourceFactory(),
      new SyntheticDataSourceFactory(
        "pointcloud",
        PointcloudPlayer,
        LAYOUTS.pointCloudMultipleThreeDee,
      ),
      new SyntheticDataSourceFactory("sinewave", SinewavePlayer, LAYOUTS.sinewave),
      new SyntheticDataSourceFactory("transform", TransformPlayer, LAYOUTS.multipleThreeDee),
      new SyntheticDataSourceFactory(
        "transformpreloading",
        TransformPreloadingPlayer,
        LAYOUTS.transformPreloading,
      ),
    ];

    return sources;
  }, []);

  const [extensionLoaders] = useState(() => []);

  const url = new URL(window.location.href);

  return (
    <App
      enableLaunchPreferenceScreen={false}
      deepLinks={[url.href]}
      dataSources={dataSources}
      appConfiguration={appConfiguration}
      extensionLoaders={extensionLoaders}
    />
  );
}
