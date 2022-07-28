// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { UlogIterableSource } from "@foxglove/studio-base/players/IterablePlayer/ulog/UlogIterableSource";
import { Player } from "@foxglove/studio-base/players/types";

class UlogLocalDataSourceFactory implements IDataSourceFactory {
  id = "ulog-local-file";
  type: IDataSourceFactory["type"] = "file";
  displayName = "PX4 ULog";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".ulg", ".ulog"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    const source = new UlogIterableSource({ type: "file", file });
    return new IterablePlayer({
      metricsCollector: args.metricsCollector,
      source,
      name: file.name,
      sourceId: this.id,
    });
  }
}

export default UlogLocalDataSourceFactory;
