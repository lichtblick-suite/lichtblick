// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type * as Comlink from "@lichtblick/comlink";

import type { WorkerSerializedIterableSourceWorker } from "./WorkerSerializedIterableSourceWorker";

export type SourceWorkerRemote = Comlink.Remote<WorkerSerializedIterableSourceWorker>;

/**
 * Worker → main telemetry bridge state for one worker remote. Pulls batches from the worker's
 * buffered sink at 1 Hz and ingests them into the main-thread sink. At most one drain is in
 * flight at a time.
 */
export type TelemetryBridge = {
  remote: SourceWorkerRemote;
  timer: ReturnType<typeof setInterval> | undefined;
  inFlight: Promise<void> | undefined;
};
