// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { Player } from "@foxglove/studio-base/players/types";

interface PlayerConstructor {
  new (): Player;
}

class SyntheticDataSourceFactory implements IDataSourceFactory {
  public id;
  public type: IDataSourceFactory["type"] = "sample";
  public displayName = "Synthetic";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";

  private newFn: PlayerConstructor;

  public constructor(id: string, newFn: PlayerConstructor) {
    this.id = id;
    this.newFn = newFn;
  }

  public initialize(_args: DataSourceFactoryInitializeArgs): Player | undefined {
    return new this.newFn();
  }
}

export { SyntheticDataSourceFactory };
