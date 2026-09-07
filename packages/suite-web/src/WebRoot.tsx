// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState } from "react";

import {
  AppBarProps,
  AppSetting,
  IExtensionLoader,
  FoxgloveWebSocketDataSourceFactory,
  IDataSourceFactory,
  IdbExtensionLoader,
  McapLocalDataSourceFactory,
  RemoteDataSourceFactory,
  RemoteExtensionLoader,
  Ros1LocalBagDataSourceFactory,
  Ros2LocalBagDataSourceFactory,
  RosbridgeDataSourceFactory,
  SampleNuscenesDataSourceFactory,
  SharedRoot,
  UlogLocalDataSourceFactory,
} from "@lichtblick/suite-base";
import { APP_CONFIG } from "@lichtblick/suite-base/constants/config";
import { AppParametersInput } from "@lichtblick/suite-base/context/AppParametersContext";

import LocalStorageAppConfiguration from "./services/LocalStorageAppConfiguration";

const isDevelopment = process.env.NODE_ENV === "development";

export function WebRoot(props: {
  extraProviders: React.JSX.Element[] | undefined;
  dataSources: IDataSourceFactory[] | undefined;
  AppBarComponent?: (props: AppBarProps) => React.JSX.Element;
  children: React.JSX.Element;
}): React.JSX.Element {
  const appConfiguration = useMemo(
    () =>
      new LocalStorageAppConfiguration({
        defaults: {
          [AppSetting.SHOW_DEBUG_PANELS]: isDevelopment,
        },
      }),
    [],
  );

  const defaultExtensionLoaders: IExtensionLoader[] = [
    new IdbExtensionLoader("org"),
    new IdbExtensionLoader("local"),
  ];
  const url = new URL(globalThis.location.href);
  const workspace = url.searchParams.get("workspace");

  if (workspace && APP_CONFIG.apiUrl) {
    defaultExtensionLoaders.push(new RemoteExtensionLoader("org", workspace));
  }
  const [extensionLoaders] = useState(() => defaultExtensionLoaders);

  const layout = url.searchParams.get("layout");
  const [appParameters] = useState<AppParametersInput>(() => {
    const params: Record<string, string> = {};
    if (layout != undefined && layout !== "") {
      params.defaultLayout = layout;
    }
    return params;
  });

  const dataSources = useMemo(() => {
    const sources = [
      new Ros1LocalBagDataSourceFactory(),
      new Ros2LocalBagDataSourceFactory(),
      new FoxgloveWebSocketDataSourceFactory(),
      new RosbridgeDataSourceFactory(),
      new UlogLocalDataSourceFactory(),
      new SampleNuscenesDataSourceFactory(),
      new McapLocalDataSourceFactory(),
      new RemoteDataSourceFactory(),
    ];

    return props.dataSources ?? sources;
  }, [props.dataSources]);

  return (
    <SharedRoot
      enableLaunchPreferenceScreen
      deepLinks={[globalThis.location.href]}
      dataSources={dataSources}
      appConfiguration={appConfiguration}
      appParameters={appParameters}
      extensionLoaders={extensionLoaders}
      enableGlobalCss
      extraProviders={props.extraProviders}
      AppBarComponent={props.AppBarComponent}
    >
      {props.children}
    </SharedRoot>
  );
}
