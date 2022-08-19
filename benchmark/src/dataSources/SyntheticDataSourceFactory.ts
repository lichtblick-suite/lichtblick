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
  public id = "synthetic";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Synthetic";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";

  public initialize(_args: DataSourceFactoryInitializeArgs): Player | undefined {
    return new SinewavePlayer();
  }
}

export { SyntheticDataSourceFactory };
