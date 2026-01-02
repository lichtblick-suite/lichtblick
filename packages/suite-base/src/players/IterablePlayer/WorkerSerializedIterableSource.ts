// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { abortSignalTransferHandler } from "@lichtblick/comlink-transfer-handlers";
import { ComlinkWrap } from "@lichtblick/den/worker";
import { Immutable, MessageEvent, Time } from "@lichtblick/suite";

import type {
  GetBackfillMessagesArgs,
  IMessageCursor,
  IteratorResult,
  MessageIteratorArgs,
  IterableSourceInitializeArgs,
  ISerializedIterableSource,
  Initialization,
} from "./IIterableSource";
import type { WorkerSerializedIterableSourceWorker } from "./WorkerSerializedIterableSourceWorker";

Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);

type ConstructorArgs = {
  initWorker: () => Worker;
  initArgs: IterableSourceInitializeArgs;
};

export class WorkerSerializedIterableSource implements ISerializedIterableSource {
  readonly #args: ConstructorArgs;

  #sourceWorkerRemote?: Comlink.Remote<WorkerSerializedIterableSourceWorker>;
  #disposeRemote?: () => void;
  public readonly sourceType = "serialized";

  public constructor(args: ConstructorArgs) {
    this.#args = args;
  }

  public async initialize(): Promise<Initialization> {
    this.#disposeRemote?.();

    // Note: this launches the worker.
    const worker = this.#args.initWorker();

    const { remote: initializeWorker, dispose } =
      ComlinkWrap<
        (args: IterableSourceInitializeArgs) => Comlink.Remote<WorkerSerializedIterableSourceWorker>
      >(worker);

    this.#disposeRemote = dispose;
    this.#sourceWorkerRemote = await initializeWorker(this.#args.initArgs);
    return await this.#sourceWorkerRemote.initialize();
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    if (this.#sourceWorkerRemote == undefined) {
      throw new Error(`WorkerIterableSource is not initialized`);
    }

    const cursor = this.getMessageCursor(args);
    try {
      for (;;) {
        // The fastest framerate that studio renders at is 60fps. So to render a frame studio needs
        // at minimum ~16 milliseconds of messages before it will render a frame. Here we fetch
        // batches of 17 milliseconds so that one batch fetch could result in one frame render.
        // Fetching too much in a batch means we cannot render until the batch is returned.
        const results = await cursor.nextBatch(17 /* milliseconds */);
        if (!results || results.length === 0) {
          break;
        }
        yield* results;
      }
    } finally {
      await cursor.end();
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    if (this.#sourceWorkerRemote == undefined) {
      throw new Error(`WorkerIterableSource is not initialized`);
    }

    // An AbortSignal is not clonable, so we remove it from the args and send it as a separate argumet
    // to our worker getBackfillMessages call. Our installed Comlink handler for AbortSignal handles
    // making the abort signal available within the worker.
    const { abortSignal, ...rest } = args;
    return await this.#sourceWorkerRemote.getBackfillMessages(rest, abortSignal);
  }

  public getMessageCursor(
    args: Immutable<MessageIteratorArgs & { abort?: AbortSignal }>,
  ): IMessageCursor<Uint8Array> {
    if (this.#sourceWorkerRemote == undefined) {
      throw new Error(`WorkerIterableSource is not initialized`);
    }

    // An AbortSignal is not clonable, so we remove it from the args and send it as a separate argumet
    // to our worker getBackfillMessages call. Our installed Comlink handler for AbortSignal handles
    // making the abort signal available within the worker.
    const { abort, ...rest } = args;
    const messageCursorPromise = this.#sourceWorkerRemote.getMessageCursor(rest, abort);

    const cursor: IMessageCursor<Uint8Array> = {
      async next() {
        const messageCursor = await messageCursorPromise;
        return await messageCursor.next();
      },

      async nextBatch(durationMs: number) {
        const messageCursor = await messageCursorPromise;
        return await messageCursor.nextBatch(durationMs);
      },

      async readUntil(end: Time) {
        const messageCursor = await messageCursorPromise;
        return await messageCursor.readUntil(end);
      },

      async end() {
        const messageCursor = await messageCursorPromise;
        try {
          await messageCursor.end();
        } finally {
          messageCursor[Comlink.releaseProxy]();
        }
      },
    };

    return cursor;
  }

  public async terminate(): Promise<void> {
    this.#disposeRemote?.();
    // shouldn't normally have to do this, but if `initialize` is called after again we don't want
    // to reuse the old remote
    this.#disposeRemote = undefined;
    this.#sourceWorkerRemote = undefined;
  }
}
