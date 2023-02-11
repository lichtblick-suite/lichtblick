// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { fromRFC3339String } from "@foxglove/rostime";
import { IterableSourceInitializeArgs } from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import { WorkerIterableSourceWorker } from "@foxglove/studio-base/players/IterablePlayer/WorkerIterableSourceWorker";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

import {
  DataPlatformIterableSource,
  DataPlatformSourceParameters,
} from "./DataPlatformIterableSource";

export function initialize(args: IterableSourceInitializeArgs): WorkerIterableSourceWorker {
  const { api, params } = args;
  if (!params) {
    throw new Error("params is required for data platform source");
  }

  if (!api) {
    throw new Error("api is required for data platfomr");
  }

  const start = params.start;
  const end = params.end;
  const deviceId = params.deviceId;
  const importId = params.importId;

  const startTime = start ? fromRFC3339String(start) : undefined;
  const endTime = end ? fromRFC3339String(end) : undefined;

  if (!(importId || (deviceId && startTime && endTime))) {
    throw new Error("invalid args");
  }

  const dpSourceParams: DataPlatformSourceParameters = importId
    ? { type: "by-import", importId, start: startTime, end: endTime }
    : { type: "by-device", deviceId: deviceId!, start: startTime!, end: endTime! };

  const consoleApi = new ConsoleApi(api.baseUrl);
  if (api.auth) {
    consoleApi.setAuthHeader(api.auth);
  }

  const source = new DataPlatformIterableSource({
    api: consoleApi,
    params: dpSourceParams,
  });
  const wrapped = new WorkerIterableSourceWorker(source);
  return Comlink.proxy(wrapped);
}

Comlink.expose(initialize);
