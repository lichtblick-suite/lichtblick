// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { HydratedSourcePoolCounterKey } from "./types";

// Cumulative integer event counters of a HydratedSourcePool, one per counter key.
export type PoolCounters = Record<HydratedSourcePoolCounterKey, number>;
