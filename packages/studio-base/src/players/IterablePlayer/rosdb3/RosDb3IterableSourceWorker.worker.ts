// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { IterableSourceInitializeArgs } from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import { WorkerIterableSourceWorker } from "@foxglove/studio-base/players/IterablePlayer/WorkerIterableSourceWorker";

import { RosDb3IterableSource } from "./RosDb3IterableSource";

export function initialize(args: IterableSourceInitializeArgs): WorkerIterableSourceWorker {
  const files = args.file ? [args.file] : args.files;
  if (!files) {
    throw new Error("files required");
  }
  const source = new RosDb3IterableSource(files);
  const wrapped = new WorkerIterableSourceWorker(source);
  return Comlink.proxy(wrapped);
}

Comlink.expose(initialize);
