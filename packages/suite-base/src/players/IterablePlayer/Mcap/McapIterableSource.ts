// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapIndexedReader, McapTypes } from "@mcap/core";

import Log from "@lichtblick/log";
import { loadDecompressHandlers } from "@lichtblick/mcap-support";
import { Time } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import { BlobReadable } from "./BlobReadable";
import { McapIndexedIterableSource } from "./McapIndexedIterableSource";
import { McapUnindexedIterableSource } from "./McapUnindexedIterableSource";
import { RemoteFileReadable } from "./RemoteFileReadable";
import {
  IteratorResult,
  Initialization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
} from "../IIterableSource";

const log = Log.getLogger(__filename);

type McapSource = { type: "file"; file: Blob } | { type: "url"; url: string };

/**
 * Create a McapIndexedReader if it will be possible to do an indexed read. If the file is not
 * indexed or is empty, returns undefined.
 */
async function tryCreateIndexedReader(readable: McapTypes.IReadable) {
  const decompressHandlers = await loadDecompressHandlers();
  try {
    const reader = await McapIndexedReader.Initialize({ readable, decompressHandlers });

    if (reader.chunkIndexes.length === 0 || reader.channelsById.size === 0) {
      return undefined;
    }
    return reader;
  } catch (err: unknown) {
    log.error(err);
    return undefined;
  }
}

export class McapIterableSource implements ISerializedIterableSource {
  #source: McapSource;
  #sourceImpl: ISerializedIterableSource | undefined;

  public readonly sourceType = "serialized";

  public constructor(source: McapSource) {
    this.#source = source;
  }

  public async initialize(): Promise<Initialization> {
    const source = this.#source;

    switch (source.type) {
      case "file": {
        // Ensure the file is readable before proceeding (will throw in the event of a permission
        // error). Workaround for the fact that `file.stream().getReader()` returns a generic
        // "network error" in the event of a permission error.
        await source.file.slice(0, 1).arrayBuffer();

        const readable = new BlobReadable(source.file);
        const reader = await tryCreateIndexedReader(readable);
        if (reader) {
          this.#sourceImpl = new McapIndexedIterableSource(reader);
        } else {
          this.#sourceImpl = new McapUnindexedIterableSource({
            size: source.file.size,
            stream: source.file.stream(),
          });
        }
        break;
      }
      case "url": {
        const readable = new RemoteFileReadable(source.url);
        await readable.open();
        const reader = await tryCreateIndexedReader(readable);
        if (reader) {
          this.#sourceImpl = new McapIndexedIterableSource(reader);
        } else {
          const response = await fetch(source.url);
          if (!response.body) {
            throw new Error(`Unable to stream remote file. <${source.url}>`);
          }
          const size = response.headers.get("content-length");
          if (size == undefined) {
            throw new Error(`Remote file is missing Content-Length header. <${source.url}>`);
          }

          this.#sourceImpl = new McapUnindexedIterableSource({
            size: parseInt(size),
            stream: response.body,
          });
        }
        break;
      }
    }

    return await this.#sourceImpl.initialize();
  }

  public messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    if (!this.#sourceImpl) {
      throw new Error("Invariant: uninitialized");
    }

    return this.#sourceImpl.messageIterator(opt);
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    if (!this.#sourceImpl) {
      throw new Error("Invariant: uninitialized");
    }

    return await this.#sourceImpl.getBackfillMessages(args);
  }

  public getStart(): Time | undefined {
    return this.#sourceImpl!.getStart!();
  }
}
