// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import {
  SAMPLE_NUSCENES_DATA_SOURCE_DISPLAY_NAME,
  SAMPLE_NUSCENES_DATA_SOURCE_ICON_NAME,
  SAMPLE_NUSCENES_DATA_SOURCE_ID,
  SAMPLE_NUSCENES_DATA_SOURCE_NAME,
  SAMPLE_NUSCENES_DATA_SOURCE_READ_AHEAD_DURATION,
  SAMPLE_NUSCENES_DATA_SOURCE_TYPE,
  SAMPLE_NUSCENES_DATA_SOURCE_URL,
} from "@lichtblick/suite-base/dataSources/constants";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";

import SampleNuscenesLayout from "./SampleNuscenesLayout.json";

class SampleNuscenesDataSourceFactory implements IDataSourceFactory {
  public id = SAMPLE_NUSCENES_DATA_SOURCE_ID;
  public type: IDataSourceFactory["type"] = SAMPLE_NUSCENES_DATA_SOURCE_TYPE;
  public displayName = SAMPLE_NUSCENES_DATA_SOURCE_DISPLAY_NAME;
  public iconName: IDataSourceFactory["iconName"] = SAMPLE_NUSCENES_DATA_SOURCE_ICON_NAME;
  public hidden = true;
  public sampleLayout = SampleNuscenesLayout as IDataSourceFactory["sampleLayout"];

  public initialize(
    args: DataSourceFactoryInitializeArgs,
  ): ReturnType<IDataSourceFactory["initialize"]> {
    const bagUrl = SAMPLE_NUSCENES_DATA_SOURCE_URL;

    const source = new WorkerSerializedIterableSource({
      initWorker: () => {
        return new Worker(
          // foxglove-depcheck-used: babel-plugin-transform-import-meta
          new URL(
            "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIterableSourceWorker.worker",
            import.meta.url,
          ),
        );
      },
      initArgs: { url: bagUrl },
    });

    return new IterablePlayer({
      source,
      isSampleDataSource: true,
      name: SAMPLE_NUSCENES_DATA_SOURCE_NAME,
      metricsCollector: args.metricsCollector,
      // Use blank url params so the data source is set in the url
      urlParams: {},
      sourceId: this.id,
      readAheadDuration: SAMPLE_NUSCENES_DATA_SOURCE_READ_AHEAD_DURATION,
    });
  }
}

export default SampleNuscenesDataSourceFactory;
