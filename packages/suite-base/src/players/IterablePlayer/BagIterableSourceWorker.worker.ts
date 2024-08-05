// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IterableSourceInitializeArgs } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { WorkerIterableSourceWorker } from "@lichtblick/suite-base/players/IterablePlayer/WorkerIterableSourceWorker";
import * as Comlink from "comlink";

import { BagIterableSource } from "./BagIterableSource";

export function initialize(args: IterableSourceInitializeArgs): WorkerIterableSourceWorker {
  if (args.file) {
    const source = new BagIterableSource({ type: "file", file: args.file });
    const wrapped = new WorkerIterableSourceWorker(source);
    return Comlink.proxy(wrapped);
  } else if (args.url) {
    const source = new BagIterableSource({ type: "remote", url: args.url });
    const wrapped = new WorkerIterableSourceWorker(source);
    return Comlink.proxy(wrapped);
  }

  throw new Error("file or url required");
}

Comlink.expose(initialize);
