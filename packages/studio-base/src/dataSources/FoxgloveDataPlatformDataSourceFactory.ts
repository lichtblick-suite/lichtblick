// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromRFC3339String } from "@foxglove/rostime";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { DataPlatformIterableSource } from "@foxglove/studio-base/players/IterablePlayer/foxglove-data-platform";
import { Player } from "@foxglove/studio-base/players/types";
import { DataPlatformSourceParameters } from "@foxglove/studio-base/services/ConsoleApi";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

class FoxgloveDataPlatformDataSourceFactory implements IDataSourceFactory {
  public id = "foxglove-data-platform";
  public type: IDataSourceFactory["type"] = "connection";
  public displayName = "Foxglove Data Platform";
  public iconName: IDataSourceFactory["iconName"] = "FileASPX";
  public hidden = true;

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if (!args.consoleApi) {
      return;
    }

    // This could benefit from schema validation rather than casting
    const start = args.start as string | undefined;
    const end = args.end as string | undefined;
    const deviceId = args.deviceId as string | undefined;
    const importId = args.importId as string | undefined;

    const startTime = start ? fromRFC3339String(start) : undefined;
    const endTime = end ? fromRFC3339String(end) : undefined;

    if (!(importId || (deviceId && startTime && endTime))) {
      return;
    }
    const dpSourceParams: DataPlatformSourceParameters = importId
      ? { type: "by-import", importId, start: startTime, end: endTime }
      : { type: "by-device", deviceId: deviceId!, start: startTime!, end: endTime! };

    const source = new DataPlatformIterableSource({
      api: args.consoleApi,
      params: dpSourceParams,
    });

    return new IterablePlayer({
      metricsCollector: args.metricsCollector,
      source,
      sourceId: this.id,
      urlParams: {
        ...(importId && { importId }),
        ...(!importId && deviceId && { deviceId }),
        ...(startTime && { start }),
        ...(endTime && { end }),
      },
      name:
        startTime && endTime && deviceId
          ? `${deviceId}, ${formatTimeRaw(startTime)} to ${formatTimeRaw(endTime)}`
          : `${importId}`,
    });
  }
}

export default FoxgloveDataPlatformDataSourceFactory;
