// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0IndexedReader, Mcap0Types } from "@mcap/core";

import Logger from "@foxglove/log";
import { loadDecompressHandlers } from "@foxglove/mcap-support";
import { FileReadable } from "@foxglove/studio-base/players/IterablePlayer/Mcap/FileReadable";
import { MessageEvent } from "@foxglove/studio-base/players/types";

import {
  IIterableSource,
  IteratorResult,
  Initalization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
} from "../IIterableSource";
import { McapIndexedIterableSource } from "./McapIndexedIterableSource";

const log = Logger.getLogger(__filename);

type McapSource = { type: "file"; file: File };

async function tryCreateIndexedReader(readable: Mcap0Types.IReadable) {
  const decompressHandlers = await loadDecompressHandlers();
  const reader = await Mcap0IndexedReader.Initialize({ readable, decompressHandlers });

  let hasMissingSchemas = false;
  for (const channel of reader.channelsById.values()) {
    if (channel.schemaId !== 0 && !reader.schemasById.has(channel.schemaId)) {
      hasMissingSchemas = true;
      break;
    }
  }
  if (reader.chunkIndexes.length === 0 || reader.channelsById.size === 0 || hasMissingSchemas) {
    log.info("Summary does not contain chunk indexes, schemas, and channels");
    return undefined;
  }
  return reader;
}

export class McapIterableSource implements IIterableSource {
  private _source: McapSource;
  private _sourceImpl: IIterableSource | undefined;

  constructor(source: McapSource) {
    this._source = source;
  }

  async initialize(): Promise<Initalization> {
    const source = this._source;
    const readable = new FileReadable(source.file);
    const reader = await tryCreateIndexedReader(readable);
    if (!reader) {
      throw new Error("The mcap file is unindexed. Only indexed files are supported.");
    }

    this._sourceImpl = new McapIndexedIterableSource(reader);
    return await this._sourceImpl.initialize();
  }

  messageIterator(opt: MessageIteratorArgs): AsyncIterator<Readonly<IteratorResult>> {
    if (!this._sourceImpl) {
      throw new Error("Invariant: uninitialized");
    }

    return this._sourceImpl.messageIterator(opt);
  }

  async getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    if (!this._sourceImpl) {
      throw new Error("Invariant: uninitialized");
    }

    return await this._sourceImpl.getBackfillMessages(args);
  }
}
