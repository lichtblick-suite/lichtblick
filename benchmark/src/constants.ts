// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Name under which the v1 report publishes the samples recorded by `recordListenerDispatchDuration`. */
export const LISTENER_DISPATCH_DURATION_METRIC = "listenerDispatchDurationMs";

/** Number of samples `BenchmarkStats` buffers before they are logged and flushed to the runner. */
export const FLUSH_SAMPLE_COUNT = 100;
