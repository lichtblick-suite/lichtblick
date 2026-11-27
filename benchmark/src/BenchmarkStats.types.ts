// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ListenerDispatchDurationSample } from "./types";

/**
 * Callback the Playwright runner exposes on `window` to receive flushed samples. The global keeps
 * its legacy name `recordFrameTimes` because the legacy artifact is still dual-written, but the
 * samples are `listenerDispatchDurationMs` values, not rendered-frame times.
 */
export type RecordListenerDispatchDurationsFn = (samples: ListenerDispatchDurationSample[]) => void;

export type BenchmarkStatsGlobal = {
  /** Legacy name; carries `listenerDispatchDurationMs` samples. */
  recordFrameTimes?: RecordListenerDispatchDurationsFn;
};
