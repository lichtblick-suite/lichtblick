// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Mcap0IndexedReader, Mcap0Types } from "@mcap/core";

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

type McapSource = { type: "file"; file: File };

async function tryCreateIndexedReader(readable: Mcap0Types.IReadable) {
  const decompressHandlers = await loadDecompressHandlers();
  const reader = await Mcap0IndexedReader.Initialize({ readable, decompressHandlers });

  if (reader.chunkIndexes.length === 0 || reader.channelsById.size === 0) {
    if (reader.summaryOffsetsByOpcode.size > 0) {
      throw new Error("The MCAP file is empty or has an incomplete summary section.");
    } else {
      throw new Error("The MCAP file is unindexed. Only indexed files are supported.");
    }
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

    this._sourceImpl = new McapIndexedIterableSource(reader);
    return await this._sourceImpl.initialize();
  }

  messageIterator(opt: MessageIteratorArgs): AsyncIterableIterator<Readonly<IteratorResult>> {
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
