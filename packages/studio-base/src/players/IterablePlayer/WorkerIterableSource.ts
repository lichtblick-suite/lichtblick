// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import {
  abortSignalTransferHandler,
  iterableTransferHandler,
} from "@foxglove/comlink-transfer-handlers";
import { MessageEvent } from "@foxglove/studio";

import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";
import type {
  WorkerIterableSourceWorker,
  WorkerIterableSourceWorkerArgs,
} from "./WorkerIterableSourceWorker.worker";

Comlink.transferHandlers.set("iterable", iterableTransferHandler);
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
    try {
      for (;;) {
        const iterResult = await iter.next();
        if (iterResult.done === true) {
          return iterResult.value;
        }
        yield iterResult.value;
      }
    } finally {
      await iter.return?.();
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

  public async terminate(): Promise<void> {
    this._thread?.terminate();
  }
}
