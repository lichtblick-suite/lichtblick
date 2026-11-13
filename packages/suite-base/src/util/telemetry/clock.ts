// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Epoch-based monotonic timestamp in milliseconds: `performance.timeOrigin + performance.now()`.
 *
 * Monotonic within a realm and comparable across realms (main thread, workers) on the same
 * machine. Wall clock (`Date.now()`) is never used for telemetry records.
 *
 * Accessed via `globalThis.performance` so it works in windows, Web Workers and Node.
 */
export function monotonicNow(): number {
  const perf = globalThis.performance;
  return perf.timeOrigin + perf.now();
}
