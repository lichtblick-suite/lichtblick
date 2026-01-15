// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { IterableSourceInitializeArgs } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { WorkerSerializedIterableSourceWorker } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSourceWorker";

import { RosDb3IterableSource } from "./RosDb3IterableSource";

export function initialize(
  args: IterableSourceInitializeArgs,
): WorkerSerializedIterableSourceWorker {
  const files = args.file ? [args.file] : args.files;
  if (!files) {
    throw new Error("files required");
  }
  const source = new RosDb3IterableSource(files);
  const wrapped = new WorkerSerializedIterableSourceWorker(source);
  return Comlink.proxy(wrapped);
}

Comlink.expose(initialize);
