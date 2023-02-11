// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { abortSignalTransferHandler } from "@foxglove/comlink-transfer-handlers";
import { MessageEvent, Time } from "@foxglove/studio";

import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  IMessageCursor,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
  IterableSourceInitializeArgs,
} from "./IIterableSource";
import type { WorkerIterableSourceWorker } from "./WorkerIterableSourceWorker";

Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);

type ConstructorArgs = {
  initWorker: () => Worker;
  initArgs: IterableSourceInitializeArgs;
};

export class WorkerIterableSource implements IIterableSource {
  private readonly _args: ConstructorArgs;

  private _thread?: Worker;
  private _worker?: Comlink.Remote<WorkerIterableSourceWorker>;

  public constructor(args: ConstructorArgs) {
    this._args = args;
  }

  public async initialize(): Promise<Initalization> {
    // Note: this launches the worker.
    this._thread = this._args.initWorker();

    const initialize = Comlink.wrap<
      (args: IterableSourceInitializeArgs) => Comlink.Remote<WorkerIterableSourceWorker>
    >(this._thread);

    const worker = (this._worker = await initialize(this._args.initArgs));
    return await worker.initialize();
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this._worker == undefined) {
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
  ): Promise<MessageEvent<unknown>[]> {
    if (this._worker == undefined) {
      throw new Error(`WorkerIterableSource is not initialized`);
    }

    // An AbortSignal is not clonable, so we remove it from the args and send it as a separate argumet
    // to our worker getBackfillMessages call. Our installed Comlink handler for AbortSignal handles
    // making the abort signal available within the worker.
    const { abortSignal, ...rest } = args;
    return await this._worker.getBackfillMessages(rest, abortSignal);
  }

  public getMessageCursor(args: MessageIteratorArgs & { abort?: AbortSignal }): IMessageCursor {
    if (this._worker == undefined) {
      throw new Error(`WorkerIterableSource is not initialized`);
    }

    // An AbortSignal is not clonable, so we remove it from the args and send it as a separate argumet
    // to our worker getBackfillMessages call. Our installed Comlink handler for AbortSignal handles
    // making the abort signal available within the worker.
    const { abort, ...rest } = args;
    const messageCursorPromise = this._worker.getMessageCursor(rest, abort);

    const cursor: IMessageCursor = {
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
    this._thread?.terminate();
  }
}
