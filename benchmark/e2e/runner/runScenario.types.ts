// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Payload of `window.recordFrameTimes` (see `benchmark/src/BenchmarkStats.ts`, `ListenerDispatchDurationSample`). */
export type RecordedFrameTime = { stamp: number; value: number; monotonicTs?: number };
