// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { abortSignalTransferHandler } from "@lichtblick/comlink-transfer-handlers";
import { Immutable, MessageEvent } from "@lichtblick/suite";
import {
  BufferedTelemetrySink,
  getTelemetry,
  setTelemetrySink,
  type TelemetryBatch,
} from "@lichtblick/suite-base/util/telemetry";

import { ComlinkTransferIteratorCursor } from "./ComlinkTransferIteratorCursor";
import type {
  GetBackfillMessagesArgs,
  IMessageCursor,
  IteratorResult,
  MessageIteratorArgs,
  ISerializedIterableSource,
  Initialization,
} from "./IIterableSource";
import { IteratorCursor } from "./IteratorCursor";

const pickTransferableBuffer = (msg: MessageEvent<Uint8Array>) => msg.message.buffer;

export class WorkerSerializedIterableSourceWorker implements ISerializedIterableSource {
  #source: ISerializedIterableSource;
  // Worker-realm telemetry sink; only created when the main thread enables the bridge.
  #telemetrySink: BufferedTelemetrySink | undefined;
  #terminated = false;

  public constructor(source: ISerializedIterableSource) {
    this.#source = source;
  }

  public readonly sourceType = "serialized";

  public async initialize(): Promise<Initialization> {
    return await this.#source.initialize();
  }

  public messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> & Comlink.ProxyMarked {
    return Comlink.proxy(this.#source.messageIterator(args));
  }

  public async getBackfillMessages(
    args: Omit<GetBackfillMessagesArgs, "abortSignal">,
    // abortSignal is a separate argument so it can be proxied by comlink since AbortSignal is not
    // clonable (and needs to signal across the worker boundary)
    abortSignal?: AbortSignal,
  ): Promise<MessageEvent<Uint8Array>[]> {
    const messages = await this.#source.getBackfillMessages({
      ...args,
      abortSignal,
    });
    return Comlink.transfer(messages, messages.map(pickTransferableBuffer));
  }

  public getMessageCursor(
    args: Omit<Immutable<MessageIteratorArgs>, "abort">,
    abort?: AbortSignal,
  ): IMessageCursor<Uint8Array> & Comlink.ProxyMarked {
    const iter = this.#source.messageIterator(args);
    const cursor = new ComlinkTransferIteratorCursor(new IteratorCursor<Uint8Array>(iter, abort));
    return Comlink.proxy(cursor);
  }

  /**
   * Installs a buffered telemetry sink in this worker realm so worker-side producers (e.g. the
   * HydratedSourcePool created by MultiIterableSource) record into it. The main thread pulls the
   * records with `drainTelemetry()`. Must be called before `initialize()` so pools constructed
   * during initialization pick up the sink. Idempotent.
   *
   * @param realm bounded realm id stamped on every record (e.g. `worker:1`).
   */
  public enableTelemetry(realm: string): void {
    if (this.#telemetrySink != undefined || this.#terminated) {
      return;
    }
    const sink = new BufferedTelemetrySink({ realm });
    sink.start();
    setTelemetrySink(sink);
    this.#telemetrySink = sink;
  }

  /**
   * Returns and removes all buffered telemetry records, or `undefined` when telemetry was never
   * enabled. After `terminate()` this is the final drain: the sink is disposed first (final
   * publish, publish timer stopped) and the realm reverts to the no-op sink, so nothing keeps
   * running in the worker. If the main thread never performs that final drain, the sink's 1 Hz
   * timer simply dies with the worker when it is disposed.
   */
  public drainTelemetry(): TelemetryBatch | undefined {
    const sink = this.#telemetrySink;
    if (sink == undefined) {
      return undefined;
    }
    if (this.#terminated) {
      sink.dispose();
      if (getTelemetry() === sink) {
        setTelemetrySink(undefined);
      }
    }
    return sink.drain();
  }

  public async terminate(): Promise<void> {
    try {
      await this.#source.terminate?.();
    } finally {
      this.#terminated = true;
      // Flush the final pool gauges/counters into the buffer for the main thread's final drain.
      // The sink is intentionally NOT disposed here: late producers (e.g. pending closes) may
      // still record until the final drainTelemetry() call disposes it.
      this.#telemetrySink?.publishNow();
    }
  }
}

Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);
