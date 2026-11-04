// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "@lichtblick/comlink";
import { abortSignalTransferHandler } from "@lichtblick/comlink-transfer-handlers";
import { ComlinkWrap } from "@lichtblick/den/worker";
import Log from "@lichtblick/log";
import { Immutable, MessageEvent, Time } from "@lichtblick/suite";
import { getTelemetry } from "@lichtblick/suite-base/util/telemetry";

import type {
  GetBackfillMessagesArgs,
  IMessageCursor,
  IteratorResult,
  MessageIteratorArgs,
  IterableSourceInitializeArgs,
  ISerializedIterableSource,
  Initialization,
} from "./IIterableSource";
import type { SourceWorkerRemote, TelemetryBridge } from "./WorkerSerializedIterableSource.types";
import type { WorkerSerializedIterableSourceWorker } from "./WorkerSerializedIterableSourceWorker";
import { TELEMETRY_DRAIN_INTERVAL_MS } from "./constants";

Comlink.transferHandlers.set("abortsignal", abortSignalTransferHandler);

const log = Log.getLogger(__filename);

type ConstructorArgs = {
  initWorker: () => Worker;
  initArgs: IterableSourceInitializeArgs;
};

// Ordinal for worker telemetry realms (`worker:<n>`). Only advanced when telemetry is enabled, so
// realm cardinality is one per worker instance launched while telemetry is on.
// It is intentionally monotonic (never reused/reset): each worker instance gets a unique realm in
// the telemetry timeline, so records from a re-initialised source are never conflated with its
// predecessor's. The number of distinct realms is bounded by the source re-initialisations in one
// benchmark run; telemetry is benchmark-only (the product installs the Noop sink, which never
// enables the bridge). Where `realm` is used as a label (e.g. the sink's dropped-records counter),
// the TelemetryLabelGuard additionally caps distinct label sets per metric
// (DEFAULT_MAX_SERIES_PER_METRIC).
let nextWorkerRealmOrdinal = 0;

async function drainBridgeOnce(remote: SourceWorkerRemote): Promise<void> {
  try {
    const batch = await remote.drainTelemetry();
    if (batch != undefined) {
      getTelemetry().ingest(batch);
    }
  } catch (err: unknown) {
    // The worker may already be gone; telemetry must never affect playback.
    log.debug("Worker telemetry drain failed", err);
  }
}

// Drain the bridge unless a drain is already in flight (in which case that drain is returned).
async function drainBridge(bridge: TelemetryBridge): Promise<void> {
  bridge.inFlight ??= drainBridgeOnce(bridge.remote).finally(() => {
    bridge.inFlight = undefined;
  });
  await bridge.inFlight;
}

function stopBridgeTimer(bridge: TelemetryBridge | undefined): void {
  if (bridge?.timer != undefined) {
    clearInterval(bridge.timer);
    bridge.timer = undefined;
  }
}

export class WorkerSerializedIterableSource implements ISerializedIterableSource {
  readonly #args: ConstructorArgs;

  #sourceWorkerRemote?: SourceWorkerRemote;
  #disposeRemote?: () => void;
  // Only set while main-thread telemetry is enabled (see #startTelemetryBridge).
  #telemetryBridge?: TelemetryBridge;
  public readonly sourceType = "serialized";

  public constructor(args: ConstructorArgs) {
    this.#args = args;
  }

  public async initialize(): Promise<Initialization> {
    // Re-init path: the previous worker is disposed below, so stop pulling from it.
    stopBridgeTimer(this.#telemetryBridge);
    this.#telemetryBridge = undefined;
    this.#disposeRemote?.();

    // Note: this launches the worker.
    const worker = this.#args.initWorker();

    const { remote: initializeWorker, dispose } =
      ComlinkWrap<
        (args: IterableSourceInitializeArgs) => Comlink.Remote<WorkerSerializedIterableSourceWorker>
      >(worker);

    this.#disposeRemote = dispose;
    const remote = await initializeWorker(this.#args.initArgs);
    if (this.#disposeRemote !== dispose) {
      // terminate() or a newer initialize() ran during the await: this endpoint is stale (already
      // disposed or superseded). Don't publish it or start a bridge whose timer nobody would stop.
      return await remote.initialize();
    }
    this.#sourceWorkerRemote = remote;
    // Telemetry must be enabled in the worker BEFORE remote.initialize(): worker-side producers
    // (e.g. MultiIterableSource's HydratedSourcePool) capture the realm sink at construction.
    if (getTelemetry().isEnabled()) {
      await this.#startTelemetryBridge(remote);
    }
    return await remote.initialize();
  }

  // Enable the worker-realm sink and start pulling its records. The bridge (incl. its timer) is
  // registered synchronously, before any await, so a concurrent terminate() always sees and stops
  // it. Failures are logged and ignored: telemetry never breaks data loading.
  async #startTelemetryBridge(remote: SourceWorkerRemote): Promise<void> {
    const bridge: TelemetryBridge = { remote, timer: undefined, inFlight: undefined };
    bridge.timer = setInterval(() => {
      void drainBridge(bridge);
    }, TELEMETRY_DRAIN_INTERVAL_MS);
    this.#telemetryBridge = bridge;
    try {
      await remote.enableTelemetry(`worker:${++nextWorkerRealmOrdinal}`);
    } catch (err: unknown) {
      log.debug("Failed to enable worker telemetry", err);
    }
    if (this.#telemetryBridge !== bridge) {
      // terminate()/re-initialize() replaced this bridge during the await: make sure it stays
      // stopped.
      stopBridgeTimer(bridge);
    }
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
    // Capture and clear this call's endpoint immediately: a concurrent initialize() call may
    // replace #sourceWorkerRemote/#disposeRemote with a newer worker while this terminate() is
    // still awaiting below, and that newer worker must not be touched or disposed by this call.
    const remote = this.#sourceWorkerRemote;
    const disposeRemote = this.#disposeRemote;
    const telemetryBridge = this.#telemetryBridge;
    this.#sourceWorkerRemote = undefined;
    this.#disposeRemote = undefined;
    this.#telemetryBridge = undefined;

    try {
      // Give the worker-side source (e.g. MultiIterableSource's pool) a chance to release pooled
      // readers/streams gracefully before the worker is hard-killed below.
      await remote?.terminate();
    } finally {
      try {
        if (telemetryBridge != undefined) {
          // Final drain (after the worker flushed its final pool counters, before the worker is
          // killed). Wait for any periodic drain in flight so batches are ingested in order.
          stopBridgeTimer(telemetryBridge);
          await telemetryBridge.inFlight;
          await drainBridge(telemetryBridge);
        }
      } finally {
        // Always dispose the captured worker, even if its graceful terminate() rejected.
        disposeRemote?.();
      }
    }
  }
}
