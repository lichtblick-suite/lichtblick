// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { iterableTransferHandler } from "@foxglove/comlink-transfer-handlers";
import { MessageEvent } from "@foxglove/studio";
import {
  IIterableSource,
  Initalization,
  GetBackfillMessagesArgs,
  MessageIteratorArgs,
  IteratorResult,
} from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";

import type { RosDb3IterableSource as RosDb3Source } from "./RosDb3IterableSource.worker";

Comlink.transferHandlers.set("iterable", iterableTransferHandler);

export class RosDb3IterableSource implements IIterableSource {
  private files: File[];
  private wrapper?: Comlink.Remote<IIterableSource>;

  public constructor(files: File[]) {
    this.files = files;
  }

  public async initialize(): Promise<Initalization> {
    // Generate a wrapper around the launched worker. Note this launches the worker and should
    // happen on-demand rather than at the file level.
    const ComlinkWrapper = Comlink.wrap<new (files: File[]) => RosDb3Source>(
      new Worker(new URL("./RosDb3IterableSource.worker", import.meta.url)),
    );

    const wrapper = (this.wrapper = await new ComlinkWrapper(this.files));
    return await wrapper.initialize();
  }

  public async *messageIterator(
    opt: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (this.wrapper == undefined) {
      throw new Error(`Rosbag2DataProvider is not initialized`);
    }

    const iter = await this.wrapper.messageIterator(opt);
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
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}
