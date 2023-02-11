// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { IterableSourceInitializeArgs } from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import { WorkerIterableSourceWorker } from "@foxglove/studio-base/players/IterablePlayer/WorkerIterableSourceWorker";

import { UlogIterableSource } from "./UlogIterableSource";

export function initialize(args: IterableSourceInitializeArgs): WorkerIterableSourceWorker {
  if (!args.file) {
    throw new Error("file required");
  }
  const source = new UlogIterableSource({ type: "file", file: args.file });
  const wrapped = new WorkerIterableSourceWorker(source);
  return Comlink.proxy(wrapped);
}

Comlink.expose(initialize);
