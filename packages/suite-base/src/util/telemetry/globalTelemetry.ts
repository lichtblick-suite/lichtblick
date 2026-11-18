// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { NOOP_TELEMETRY } from "./NoopTelemetry";
import { ITelemetry } from "./types";

let currentSink: ITelemetry = NOOP_TELEMETRY;

/**
 * Returns the telemetry sink of the current JS realm (main thread or worker).
 * Defaults to a no-op sink; call sites should check `isEnabled()` before computing values.
 */
export function getTelemetry(): ITelemetry {
  return currentSink;
}

/**
 * Installs the telemetry sink for the current JS realm (module-level state, so each worker
 * has its own). Passing `undefined` resets to the no-op sink.
 *
 * Today only the benchmark app (`benchmark/src`) installs a sink; product code always sees the
 * no-op. A future product-level activation flag could call this as well.
 *
 * Install the sink before the app renders and before players are created. Some instrumentation
 * reads `isEnabled()` only once: panel subscriber registration (`usePanelSubscriberTelemetry`)
 * when its effect runs, and `HydratedSourcePool` at construction. Those created earlier are never
 * instrumented. Toggling `isEnabled()` later is fine; call sites on hot paths re-check it.
 */
export function setTelemetrySink(sink: ITelemetry | undefined): void {
  currentSink = sink ?? NOOP_TELEMETRY;
}
