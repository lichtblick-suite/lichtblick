// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * One `listenerDispatchDurationMs` sample.
 *
 * `stamp` (wall-clock seconds) and `value` (ms) are the legacy fields of the raw benchmark artifact
 * (`FrameTimeSample` in `benchmark/e2e/types.ts`) and must stay unchanged. `monotonicTs`
 * (`monotonicNow()`, ms) lets the sample be aligned with telemetry records.
 */
export type ListenerDispatchDurationSample = {
  stamp: number;
  value: number;
  monotonicTs: number;
};
