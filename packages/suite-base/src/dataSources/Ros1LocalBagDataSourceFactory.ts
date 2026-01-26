// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@lichtblick/suite-base/players/IterablePlayer";
import { WorkerSerializedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSource";
import { Player } from "@lichtblick/suite-base/players/types";

class Ros1LocalBagDataSourceFactory implements IDataSourceFactory {
  public id = "ros1-local-bagfile";
  public type: IDataSourceFactory["type"] = "file";
  public displayName = "ROS 1 Bag";
  public iconName: IDataSourceFactory["iconName"] = "OpenFile";
  public supportedFileTypes = [AllowedFileExtensions.BAG];

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const files = args.files ?? [];

    if (args.file) {
      files.push(args.file);
    }
    if (files.length === 0) {
      return;
    }

    const file: File | undefined = files[0];
    if (!file) {
      return;
    }

    const source = new WorkerSerializedIterableSource({
      initWorker: () => {
        return new Worker(
          // foxglove-depcheck-used: babel-plugin-transform-import-meta
          new URL(
            "@lichtblick/suite-base/players/IterablePlayer/BagIterableSourceWorker.worker",
            import.meta.url,
          ),
        );
      },
      initArgs: { file },
    });

    return new IterablePlayer({
      metricsCollector: args.metricsCollector,
      source,
      name: file.name,
      sourceId: this.id,
      readAheadDuration: { sec: 120, nsec: 0 },
    });
  }
}

export default Ros1LocalBagDataSourceFactory;
