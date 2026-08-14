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
import type {
  HydratedInner,
  IndexedReaderResult,
  McapSource,
  OpenedInner,
} from "./McapIterableSource.types";
import { McapUnindexedIterableSource } from "./McapUnindexedIterableSource";
import { RemoteFileReadable } from "./RemoteFileReadable";
import { READER_BASE_BYTES, estimateReaderWeightBytes } from "./readerWeight";
import {
  IteratorResult,
  Initialization,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
} from "../IIterableSource";
import { HydratedSourcePool, SourceHydrator } from "../shared/HydratedSourcePool";

const log = Log.getLogger(__filename);

/**
 * Create a McapIndexedReader if it will be possible to do an indexed read. Distinguishes a
 * genuinely unindexed/empty file (safe, expected fallback to streaming read) from an operational
 * failure while attempting indexed initialization (e.g. a network/range-read error from the
 * underlying `readable`, or a malformed/corrupt index) — the latter must NOT be silently treated
 * as "unindexed", since that would mask a real error behind an unbounded, unpooled eager-streaming
 * fallback (see `#eagerInner`).
 */
async function tryCreateIndexedReader(
  readable: McapTypes.IReadable,
  decompressHandlers: McapTypes.DecompressHandlers,
): Promise<IndexedReaderResult> {
  let reader: McapIndexedReader;
  try {
    reader = await McapIndexedReader.Initialize({
      readable,
      decompressHandlers,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    // @mcap/core throws exactly this message (plus a " [library=...]" suffix) when the file has
    // no summary section at all (footer.summaryStart === 0n) — a genuinely unindexed file, not an
    // operational failure. Any other message indicates a malformed file or an I/O error bubbling
    // up from `readable` and must be surfaced as a real failure, not silently swallowed.
    if (error.message.includes("File is not indexed")) {
      return { status: "unindexed" };
    }
    log.error(error);
    return { status: "failed", error };
  }

  if (reader.chunkIndexes.length === 0 || reader.channelsById.size === 0) {
    // Parsed successfully but genuinely has no index data (e.g. an empty recording).
    return { status: "unindexed" };
  }
  return { status: "indexed", reader };
}

export class McapIterableSource implements ISerializedIterableSource {
  #source: McapSource;
  // Eagerly-retained inner: used for local blobs, unindexed streams, and unpooled sources.
  #eagerInner: ISerializedIterableSource | undefined;
  // Set when this source is managed by a bounded LRU pool (re-hydrated on demand).
  #pool: HydratedSourcePool | undefined;
  #start?: Time;
  #end?: Time;
  // Session-persistent remote connection + byte cache for `type: "url"` indexed sources.
  // Created once (on first hydration) and reused across every subsequent re-hydration, so pool
  // eviction only discards the heavyweight indexed-reader/parsed-channel state. Closed only in
  // terminate(). Undefined for "file" sources and for remote sources that fail indexed init or
  // fall back to eager unindexed streaming.
  #persistentReadable: RemoteFileReadable | undefined;

  public readonly sourceType = "serialized";

  public constructor(source: McapSource) {
    this.#source = source;
  }

  // Build a fresh inner source. Returns the readable for remote sources so it can be closed later.
  async #openInner(): Promise<OpenedInner> {
    const source = this.#source;

    // Preload decompression handlers so WASM is ready before any read that needs it.
    const decompressHandlers = await loadDecompressHandlers();

    switch (source.type) {
      case "file":
        return await this.#openFileSource(source, decompressHandlers);
      case "url":
        return await this.#openUrlSource(source, decompressHandlers);
    }
  }

  async #openFileSource(
    source: Extract<McapSource, { type: "file" }>,
    decompressHandlers: McapTypes.DecompressHandlers,
  ): Promise<OpenedInner> {
    // Ensure the file is readable before proceeding (will throw in the event of a permission
    // error). Workaround for the fact that `file.stream().getReader()` returns a generic
    // "network error" in the event of a permission error.
    await source.file.slice(0, 1).arrayBuffer();

    const readable = new BlobReadable(source.file);
    const result = await tryCreateIndexedReader(readable, decompressHandlers);
    if (result.status === "failed") {
      // A real initialization failure (not "unindexed") must not be masked by the eager,
      // unbounded streaming fallback — surface it so the caller sees an actual error.
      throw result.error;
    }
    if (result.status === "indexed") {
      return {
        inner: new McapIndexedIterableSource(result.reader),
        indexed: true,
        weightBytes: estimateReaderWeightBytes(result.reader),
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

  async #openUrlSource(
    source: Extract<McapSource, { type: "url" }>,
    decompressHandlers: McapTypes.DecompressHandlers,
  ): Promise<OpenedInner> {
    let readable = this.#persistentReadable;
    if (!readable) {
      readable = new RemoteFileReadable(source.url, {
        cacheSizeInBytes: source.cacheSizeInBytes,
        readAheadEnabled: source.readAheadEnabled,
        ...(source.readAheadBufferBytes != undefined
          ? { readAheadBufferBytes: source.readAheadBufferBytes }
          : {}),
      });
      await readable.open();
      this.#persistentReadable = readable;
    }
    const result = await tryCreateIndexedReader(readable, decompressHandlers);
    if (result.status === "failed") {
      // A real initialization failure (not "unindexed") must not be masked by re-fetching the
      // whole file via the eager, unbounded streaming fallback — surface the actual error.
      readable.close();
      this.#persistentReadable = undefined;
      throw result.error;
    }
    if (result.status === "indexed") {
      return {
        inner: new McapIndexedIterableSource(result.reader),
        readable,
        indexed: true,
        weightBytes: estimateReaderWeightBytes(result.reader),
      };
    }
    // Unindexed remote fallback: single-pass streaming read of the whole file. This path
    // bypasses the pool entirely and never re-hydrates, so there is no benefit in keeping the
    // indexed-init probe connection/cache alive.
    readable.close();
    this.#persistentReadable = undefined;
    return await this.#openUnindexedUrlFallback(source.url);
  }

  async #openUnindexedUrlFallback(url: string): Promise<OpenedInner> {
    const response = await fetch(url);
    if (!response.body) {
      throw new Error(`Unable to stream remote file. <${url}>`);
    }
    const size = response.headers.get("content-length");
    if (size == undefined) {
      throw new Error(`Remote file is missing Content-Length header. <${url}>`);
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

  // Pool hydrator: builds a ready-to-iterate indexed inner (channels parsed). The underlying
  // remote readable/connection is session-persistent and intentionally survives pool eviction.
  readonly #hydrator: SourceHydrator<HydratedInner> = {
    open: async () => {
      const { inner, readable, weightBytes } = await this.#openInner();
      await inner.initialize();
      return { inner, readable, weightBytes };
    },
    close: async (_value) => {
      // The underlying RemoteFileReadable/connection is session-persistent (see
      // #persistentReadable) and is intentionally NOT closed here. Eviction only discards the
      // heavyweight indexed-reader/parsed-channel structures, which are rebuilt on the next
      // acquire() from the already-open, already-cached remote source.
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
    // The pool's hydrator.close() intentionally does not close this — it is session-persistent
    // (see #persistentReadable) and is only closed when the whole source is torn down.
    this.#persistentReadable?.close();
    this.#persistentReadable = undefined;
  }
}
