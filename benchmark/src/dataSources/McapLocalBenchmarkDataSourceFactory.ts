// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { McapIterableSource } from "@foxglove/studio-base/players/IterablePlayer/Mcap/McapIterableSource";
import { Player } from "@foxglove/studio-base/players/types";

import { BenchmarkPlayer } from "../players";

class McapLocalBenchmarkDataSourceFactory implements IDataSourceFactory {
  id = "mcap-local-file";
  type: IDataSourceFactory["type"] = "file";
  displayName = "MCAP";
  iconName: IDataSourceFactory["iconName"] = "OpenFile";
  supportedFileTypes = [".mcap"];

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    const file = args.file;
    if (!file) {
      return;
    }

    const mcapProvider = new McapIterableSource({ type: "file", file });
    return new BenchmarkPlayer(file.name, mcapProvider);
  }
}

export default McapLocalBenchmarkDataSourceFactory;
