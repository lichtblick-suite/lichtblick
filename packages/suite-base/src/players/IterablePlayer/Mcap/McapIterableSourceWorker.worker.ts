// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { IterableSourceInitializeArgs } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { WorkerSerializedIterableSourceWorker } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSourceWorker";
import { MultiIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/shared/MultiIterableSource";

import { McapIterableSource } from "./McapIterableSource";

export function initialize(
  args: IterableSourceInitializeArgs,
): WorkerSerializedIterableSourceWorker {
  if (args.file) {
    const source = new McapIterableSource({ type: "file", file: args.file });
    const wrapped = new WorkerSerializedIterableSourceWorker(source);
    return Comlink.proxy(wrapped);
  } else if (args.files) {
    const source = new MultiIterableSource(
      { type: "files", files: args.files },
      McapIterableSource,
    );
    const wrapped = new WorkerSerializedIterableSourceWorker(source);
    return Comlink.proxy(wrapped);
  } else if (args.url) {
    const source = new McapIterableSource({ type: "url", url: args.url });
    const wrapped = new WorkerSerializedIterableSourceWorker(source);
    return Comlink.proxy(wrapped);
  } else if (args.urls) {
    const source = new MultiIterableSource({ type: "urls", urls: args.urls }, McapIterableSource);
    const wrapped = new WorkerSerializedIterableSourceWorker(source);
    return Comlink.proxy(wrapped);
  }

  throw new Error("file or url required");
}

Comlink.expose(initialize);
