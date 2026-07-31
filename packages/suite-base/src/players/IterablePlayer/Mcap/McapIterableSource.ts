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
import { HydratedSourcePool, SourceHydrator } from "../shared/HydratedSourcePool";

const log = Log.getLogger(__filename);

// Heuristic per-reader resident-memory weights (bytes) used by the pool's byte budget. Absolute
// values are approximate; the RELATIVE weighting (heavier index/more channels => evicted sooner)
// is what matters. Calibrate against real datasets before loosening pool defaults.
const READER_BASE_BYTES = 2 * 1024 * 1024; // fixed reader/deserializer overhead
const BYTES_PER_CHUNK_INDEX = 512; // per chunk-index entry retained by McapIndexedReader
const BYTES_PER_CHANNEL = 16 * 1024; // parsed schema + per-channel deserializer

function estimateReaderWeightBytes(reader: McapIndexedReader, cacheBytes: number): number {
  return (
    READER_BASE_BYTES +
    reader.chunkIndexes.length * BYTES_PER_CHUNK_INDEX +
    reader.channelsById.size * BYTES_PER_CHANNEL +
    cacheBytes
  );
}

type McapSource =
  | { type: "file"; file: Blob; pool?: HydratedSourcePool }
  | {
      type: "url";
      url: string;
      cacheSizeInBytes?: number;
      readAheadEnabled?: boolean;
      pool?: HydratedSourcePool;
    };

type HydratedInner = {
  inner: ISerializedIterableSource;
  readable?: RemoteFileReadable;
  weightBytes: number;
};

/**
 * Create a McapIndexedReader if it will be possible to do an indexed read. If the file is not
 * indexed or is empty, returns undefined.
 */
async function tryCreateIndexedReader(
  readable: McapTypes.IReadable,
  decompressHandlers: McapTypes.DecompressHandlers,
): Promise<McapIndexedReader | undefined> {
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
  // Eagerly-retained inner: used for local blobs, unindexed streams, and unpooled sources.
  #eagerInner: ISerializedIterableSource | undefined;
  // Set when this source is managed by a bounded LRU pool (re-hydrated on demand).
  #pool: HydratedSourcePool | undefined;
  #start?: Time;
  #end?: Time;

  public readonly sourceType = "serialized";

  public constructor(source: McapSource) {
    this.#source = source;
  }

  // Build a fresh inner source. Returns the readable for remote sources so it can be closed later.
  async #openInner(): Promise<{
    inner: ISerializedIterableSource;
    readable?: RemoteFileReadable;
    indexed: boolean;
    weightBytes: number;
  }> {
    const source = this.#source;

    // Preload decompression handlers so WASM is ready before any read that needs it.
    const decompressHandlers = await loadDecompressHandlers();

    switch (source.type) {
      case "file": {
        // Ensure the file is readable before proceeding (will throw in the event of a permission
        // error). Workaround for the fact that `file.stream().getReader()` returns a generic
        // "network error" in the event of a permission error.
        await source.file.slice(0, 1).arrayBuffer();

        const readable = new BlobReadable(source.file);
        const reader = await tryCreateIndexedReader(readable, decompressHandlers);
        if (reader) {
          return {
            inner: new McapIndexedIterableSource(reader),
            indexed: true,
            weightBytes: estimateReaderWeightBytes(reader, 0),
          };
        }
        return {
          inner: new McapUnindexedIterableSource({
            size: source.file.size,
            stream: source.file.stream(),
          }),
          indexed: false,
          weightBytes: READER_BASE_BYTES,
        };
      }
      case "url": {
        const readable = new RemoteFileReadable(source.url, {
          cacheSizeInBytes: source.cacheSizeInBytes,
          readAheadEnabled: source.readAheadEnabled,
        });
        await readable.open();
        const reader = await tryCreateIndexedReader(readable, decompressHandlers);
        if (reader) {
          return {
            inner: new McapIndexedIterableSource(reader),
            readable,
            indexed: true,
            weightBytes: estimateReaderWeightBytes(reader, source.cacheSizeInBytes ?? 0),
          };
        }
        // Unindexed remote fallback: single-pass streaming read of the whole file.
        readable.close();
        const response = await fetch(source.url);
        if (!response.body) {
          throw new Error(`Unable to stream remote file. <${source.url}>`);
        }
        const size = response.headers.get("content-length");
        if (size == undefined) {
          throw new Error(`Remote file is missing Content-Length header. <${source.url}>`);
        }
        return {
          inner: new McapUnindexedIterableSource({
            size: Number.parseInt(size, 10),
            stream: response.body,
          }),
          indexed: false,
          weightBytes: READER_BASE_BYTES,
        };
      }
    }
  }

  // Pool hydrator: builds a ready-to-iterate indexed inner (channels parsed) plus its readable so
  // it can be closed on eviction.
  readonly #hydrator: SourceHydrator<HydratedInner> = {
    open: async () => {
      const { inner, readable, weightBytes } = await this.#openInner();
      await inner.initialize();
      return { inner, readable, weightBytes };
    },
    close: async ({ readable }) => {
      readable?.close();
    },
    weigh: ({ weightBytes }) => weightBytes,
  };

  public async initialize(): Promise<Initialization> {
    const opened = await this.#openInner();
    const init = await opened.inner.initialize();
    this.#start = init.start;
    this.#end = init.end;

    const pool = this.#source.pool;
    if (pool && opened.indexed) {
      this.#pool = pool;
      // Seed the pool with the already-hydrated inner (no redundant open). May be evicted+closed
      // immediately if the pool is already at capacity.
      await pool.admit(this, this.#hydrator, {
        inner: opened.inner,
        readable: opened.readable,
        weightBytes: opened.weightBytes,
      });
    } else {
      // Unindexed (and unpooled) sources are retained eagerly for the whole session and are NOT
      // bounded by the pool. A session of many large unindexed MCAPs can therefore grow unbounded;
      // pooling them is non-trivial because re-hydration would re-stream the entire file.
      this.#eagerInner = opened.inner;
    }
    return init;
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    // NOTE: this is an async generator, so the "uninitialized" invariant below throws on the first
    // .next() call, not when messageIterator() is invoked. Callers that expect a synchronous throw
    // (mergeSequentialIterators calls .next(), so it surfaces there) should account for this.
    if (!this.#pool) {
      if (!this.#eagerInner) {
        throw new Error("Invariant: uninitialized");
      }
      yield* this.#eagerInner.messageIterator(opt);
      return;
    }
    const { inner } = await this.#pool.acquire(this, this.#hydrator);
    try {
      yield* inner.messageIterator(opt);
    } finally {
      this.#pool.release(this);
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    if (!this.#pool) {
      if (!this.#eagerInner) {
        throw new Error("Invariant: uninitialized");
      }
      return await this.#eagerInner.getBackfillMessages(args);
    }
    const { inner } = await this.#pool.acquire(this, this.#hydrator);
    try {
      return await inner.getBackfillMessages(args);
    } finally {
      this.#pool.release(this);
    }
  }

  public getStart(): Time | undefined {
    return this.#start;
  }

  public getEnd(): Time | undefined {
    return this.#end;
  }

  // Warm this source into the pool (resident + most-recently-used) without holding a pin, so the
  // earliest-by-start sources are ready before playback begins. No-op for unpooled sources.
  public async prewarm(): Promise<void> {
    if (!this.#pool) {
      return;
    }
    await this.#pool.acquire(this, this.#hydrator);
    this.#pool.release(this);
  }

  public async terminate(): Promise<void> {
    // Pooled inners are torn down by the pool (owned by MultiIterableSource); only release an
    // eagerly-retained inner here.
    await this.#eagerInner?.terminate?.();
  }
}
