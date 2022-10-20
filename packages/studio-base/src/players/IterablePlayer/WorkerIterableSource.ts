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
} from "./IIterableSource";
import type {
  WorkerIterableSourceWorker,
  WorkerIterableSourceWorkerArgs,
} from "./WorkerIterableSourceWorker.worker";

Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);

export class WorkerIterableSource implements IIterableSource {
  private readonly _args: WorkerIterableSourceWorkerArgs;

  private _thread?: Worker;
  private _worker?: Comlink.Remote<WorkerIterableSourceWorker>;

  public constructor(args: WorkerIterableSourceWorkerArgs) {
    this._args = args;
  }

  public async initialize(): Promise<Initalization> {
    // Note: this launches the worker.
    this._thread = new Worker(new URL("./WorkerIterableSourceWorker.worker", import.meta.url));

    const Wrapped = Comlink.wrap<
      new (args: WorkerIterableSourceWorkerArgs) => WorkerIterableSourceWorker
    >(this._thread);

    const worker = (this._worker = await new Wrapped(this._args));
    return await worker.initialize();
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this._worker == undefined) {
      throw new Error(`WorkerIterableSource is not initialized`);
    }

    const iter = await this._worker.messageIterator(args);
    const ret = iter.return;

    try {
      for (;;) {
        const iterResult = await iter.next();
        if (iterResult.done === true) {
          return iterResult.value;
        }
        yield iterResult.value;
      }
    } finally {
      // Note: typescript types for iter.return don't narrow this to a function so we have this
      // check in place to appease the types. This is not on a hot-path.
      if (typeof ret === "function") {
        await ret();
      }
      iter[Comlink.releaseProxy]();
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
