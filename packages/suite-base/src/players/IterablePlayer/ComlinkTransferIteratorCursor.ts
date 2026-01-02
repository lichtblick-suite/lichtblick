// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as Comlink from "@lichtblick/comlink";
import { Time } from "@lichtblick/suite";

import type { IMessageCursor, IteratorResult } from "./IIterableSource";

/**
 * Wraps a IMessageCursor<Uint8Array> and returns message-events with calls to Comlink.transfer.
 * This allows ArrayBuffers to be transferred rather than being structureClone'd which is significantly faster.
 * This class must only be used for worker communication because otherwise Comlink's interal transfer buffer
 * will never be emptied leading to an OOM.
 */
class ComlinkTransferIteratorCursor implements IMessageCursor<Uint8Array> {
  #cursor: IMessageCursor<Uint8Array>;

  public constructor(cursor: IMessageCursor<Uint8Array>) {
    this.#cursor = cursor;
  }

  public async next(): ReturnType<IMessageCursor<Uint8Array>["next"]> {
    const next = await this.#cursor.next();
    if (next == undefined) {
      return next;
    }

    if (next.type === "message-event" && next.msgEvent.message instanceof Uint8Array) {
      return Comlink.transfer(next, [next.msgEvent.message.buffer]);
    }

    return next;
  }

  public async nextBatch(durationMs: number): Promise<IteratorResult<Uint8Array>[] | undefined> {
    const batch = await this.#cursor.nextBatch(durationMs);
    if (batch == undefined) {
      return batch;
    }

    const transferables: Transferable[] = [];
    for (const iterResult of batch) {
      if (
        iterResult.type === "message-event" &&
        iterResult.msgEvent.message instanceof Uint8Array
      ) {
        transferables.push(iterResult.msgEvent.message.buffer);
      }
    }
    return Comlink.transfer(batch, transferables);
  }

  public async readUntil(end: Time): ReturnType<IMessageCursor<Uint8Array>["readUntil"]> {
    return await this.#cursor.readUntil(end);
  }

  public async end(): ReturnType<IMessageCursor<Uint8Array>["end"]> {
    await this.#cursor.end();
  }
}

export { ComlinkTransferIteratorCursor };
