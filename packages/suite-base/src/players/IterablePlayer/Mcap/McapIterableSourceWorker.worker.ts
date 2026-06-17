// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import {
  ISerializedIterableSource,
  IterableSourceInitializeArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import { WorkerSerializedIterableSourceWorker } from "@lichtblick/suite-base/players/IterablePlayer/WorkerSerializedIterableSourceWorker";
import { AdditionalIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/additionalSources/AdditionalIterableSource";
import { CombinedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/shared/CombinedIterableSource";
import { MultiIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/shared/MultiIterableSource";

import { McapIterableSource } from "./McapIterableSource";

/**
 * Merge the primary MCAP source with any additional sources declared on `args`.
 *
 * Each additional source is self-describing (it carries its own topics, schemas and serialized
 * messages); we only wrap it in a generic {@link AdditionalIterableSource}. When there are none the
 * primary source is returned unchanged so the common case keeps its existing behaviour.
 */
function withAdditionalSources(
  primary: ISerializedIterableSource,
  args: IterableSourceInitializeArgs,
): ISerializedIterableSource {
  const descriptors = args.additionalSources ?? [];
  if (descriptors.length === 0) {
    return primary;
  }

  const additionalSources = descriptors.map(
    (descriptor) => new AdditionalIterableSource(descriptor),
  );
  return new CombinedIterableSource(primary, additionalSources);
}

export function initialize(
  args: IterableSourceInitializeArgs,
): WorkerSerializedIterableSourceWorker {
  let source: ISerializedIterableSource | undefined;

  if (args.file) {
    source = new McapIterableSource({ type: "file", file: args.file });
  } else if (args.files) {
    source = new MultiIterableSource({ type: "files", files: args.files }, McapIterableSource);
  } else if (args.url) {
    source = new McapIterableSource({ type: "url", url: args.url });
  } else if (args.urls) {
    source = new MultiIterableSource({ type: "urls", urls: args.urls }, McapIterableSource);
  }

  if (!source) {
    throw new Error("file or url required");
  }

  const wrapped = new WorkerSerializedIterableSourceWorker(withAdditionalSources(source, args));
  return Comlink.proxy(wrapped);
}

Comlink.expose(initialize);
