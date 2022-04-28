// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fromRFC3339String, toRFC3339String } from "@foxglove/rostime";
import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import FoxgloveDataPlatformPlayer from "@foxglove/studio-base/players/FoxgloveDataPlatformPlayer";
import { IterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { DataPlatformIterableSource } from "@foxglove/studio-base/players/IterablePlayer/DataPlatformIterableSource";
import { Player } from "@foxglove/studio-base/players/types";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

class FoxgloveDataPlatformDataSourceFactory implements IDataSourceFactory {
  id = "foxglove-data-platform";
  type: IDataSourceFactory["type"] = "connection";
  displayName = "Foxglove Data Platform";
  iconName: IDataSourceFactory["iconName"] = "FileASPX";
  hidden = true;
  private useIterablePlayer: boolean;

  constructor(opt?: { useIterablePlayer: boolean }) {
    this.useIterablePlayer = opt?.useIterablePlayer ?? false;
  }

  initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if (!args.consoleApi) {
      return;
    }

    // This could benefit from schema validation rather than casting
    const start = args.start as string | undefined;
    const end = args.end as string | undefined;
    const deviceId = args.deviceId as string | undefined;
    if (!start || !end || !deviceId) {
      return;
    }

    if (this.useIterablePlayer) {
      const startTime = fromRFC3339String(start);
      const endTime = fromRFC3339String(end);
      if (!startTime || !endTime) {
        return;
      }
      const source = new DataPlatformIterableSource({
        api: args.consoleApi,
        start: startTime,
        end: endTime,
        deviceId,
      });
      return new IterablePlayer({
        metricsCollector: args.metricsCollector,
        source,
        sourceId: this.id,
        urlParams: {
          deviceId,
          start: toRFC3339String(startTime),
          end: toRFC3339String(endTime),
        },
        name: `${deviceId}, ${formatTimeRaw(startTime)} to ${formatTimeRaw(endTime)}`,
      });
    }
    return new FoxgloveDataPlatformPlayer({
      params: {
        start,
        end,
        deviceId,
        seek: args.seek as string | undefined,
      },
      consoleApi: args.consoleApi,
      metricsCollector: args.metricsCollector,
      sourceId: this.id,
    });
  }
}

export default FoxgloveDataPlatformDataSourceFactory;
