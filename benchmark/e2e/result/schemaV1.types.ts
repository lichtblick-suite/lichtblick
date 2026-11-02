// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { TelemetrySample } from "../../../packages/suite-base/src/util/telemetry/types";

/** Full pool metric name (a `POOL_METRICS` value) -> samples (sorted). */
export type PoolSeries = Map<string, TelemetrySample[]>;
