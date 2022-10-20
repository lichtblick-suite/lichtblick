// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { abortSignalTransferHandler } from "@foxglove/comlink-transfer-handlers";
import { MessageEvent } from "@foxglove/studio";

import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  IMessageCursor,
  Initalization,
  IterableSourceInitializeArgs,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";
import { IteratorCursor } from "./IteratorCursor";

type SourceFn = () => Promise<{
  initialize: (args: IterableSourceInitializeArgs) => IIterableSource;
}>;

const RegisteredSourceModuleLoaders: Record<string, SourceFn> = {
  mcap: async () => await import("./Mcap/McapIterableSource"),
  rosbag: async () => await import("./BagIterableSource"),
  rosdb3: async () => await import("./rosdb3/RosDb3IterableSource"),
  ulog: async () => await import("./ulog/UlogIterableSource"),
  foxgloveDataPlatform: async () =>
    await import("./foxglove-data-platform/DataPlatformIterableSource"),
};

export type WorkerIterableSourceWorkerArgs = {
  sourceType: string;
  initArgs: IterableSourceInitializeArgs;
};

export class WorkerIterableSourceWorker {
  private readonly _args: WorkerIterableSourceWorkerArgs;

  private _source?: IIterableSource;

  public constructor(args: WorkerIterableSourceWorkerArgs) {
    this._args = args;
  }

  public async initialize(): Promise<Initalization> {
    const loadRegisteredSourceModule = RegisteredSourceModuleLoaders[this._args.sourceType];
    if (!loadRegisteredSourceModule) {
      throw new Error(`No source for type: ${this._args.sourceType}`);
    }
    const module = await loadRegisteredSourceModule();
    this._source = module.initialize(this._args.initArgs);
    return await this._source.initialize();
  }

  public messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> & Comlink.ProxyMarked {
    if (!this._source) {
      throw new Error("uninitialized");
    }

    return Comlink.proxy(this._source.messageIterator(args));
  }

  public async getBackfillMessages(
    args: Omit<GetBackfillMessagesArgs, "abortSignal">,
    // abortSignal is a separate argument so it can be proxied by comlink since AbortSignal is not
    // clonable (and needs to signal across the worker boundary)
    abortSignal?: AbortSignal,
  ): Promise<MessageEvent<unknown>[]> {
    if (!this._source) {
      throw new Error("uninitialized");
    }
    return await this._source.getBackfillMessages({
      ...args,
      abortSignal,
    });
  }

  public getMessageCursor(
    args: Omit<MessageIteratorArgs, "abort">,
    abort?: AbortSignal,
  ): IMessageCursor & Comlink.ProxyMarked {
    const iter = this.messageIterator(args);
    const cursor = new IteratorCursor(iter, abort);

    return Comlink.proxy(cursor);
  }
}

Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);
Comlink.expose(WorkerIterableSourceWorker);
