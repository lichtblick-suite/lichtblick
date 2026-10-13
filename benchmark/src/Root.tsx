// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState } from "react";

import {
  SharedRoot,
  IDataSourceFactory,
  AppSetting,
  LaunchPreferenceValue,
  StudioApp,
} from "@lichtblick/suite-base";
import { AppParametersInput } from "@lichtblick/suite-base/context/AppParametersContext";

import {
  McapLocalBenchmarkDataSourceFactory,
  McapRealPipelineBenchmarkDataSourceFactory,
  SyntheticDataSourceFactory,
} from "./dataSources";
import { LAYOUTS } from "./layouts";
import {
  PointcloudPlayer,
  SinewavePlayer,
  TransformPlayer,
  TransformPreloadingPlayer,
} from "./players";
import { BenchmarkAppBar } from "./scenarios";
import { getScenarioFromUrl } from "./scenarios/registry";
import { MemoryAppConfiguration } from "./services";

export function Root(): React.JSX.Element {
  const [appConfiguration] = useState(
    () =>
      new MemoryAppConfiguration({
        defaults: {
          [AppSetting.LAUNCH_PREFERENCE]: LaunchPreferenceValue.WEB,
          [AppSetting.MESSAGE_RATE]: 240,
          [AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP]: false,
        },
      }),
  );

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [
      new McapLocalBenchmarkDataSourceFactory(),
      new McapRealPipelineBenchmarkDataSourceFactory(),
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

  // `useScenarioBootstrap` installs and selects this same `scenario:<id>` layout, but only once
  // its own (async) install effect resolves. Passing it here too lets `CurrentLayoutProvider`
  // select it deterministically on mount (see its `appParameters.defaultLayout` handling),
  // instead of racing that effect against its own mount-time "restore last layout" logic.
  const [appParameters] = useState<AppParametersInput>(() => {
    const scenario = getScenarioFromUrl(url);
    return scenario ? { defaultLayout: `scenario:${scenario.id}` } : { defaultLayout: "Default" };
  });

  return (
    <SharedRoot
      enableLaunchPreferenceScreen={false}
      deepLinks={[url.href]}
      appParameters={appParameters}
      dataSources={dataSources}
      appConfiguration={appConfiguration}
      extensionLoaders={extensionLoaders}
      AppBarComponent={BenchmarkAppBar}
      enableGlobalCss
    >
      <StudioApp />
    </SharedRoot>
  );
}
