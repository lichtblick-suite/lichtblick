// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { Player } from "@foxglove/studio-base/players/types";

import { SinewavePlayer } from "../players";

class SyntheticDataSourceFactory implements IDataSourceFactory {
  id = "synthetic";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "Synthetic";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";

  initialize(_args: DataSourceFactoryInitializeArgs): Player | undefined {
    return new SinewavePlayer();
  }
}

export { SyntheticDataSourceFactory };
