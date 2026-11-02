// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { LichtblickTelemetryWindowKey } from "./types";

/** `?telemetry=off` disables benchmark telemetry (used for the telemetry-overhead A/B run). */
export const TELEMETRY_QUERY_PARAM = "telemetry";
export const TELEMETRY_OFF_VALUE = "off";

/** Realm of the main-thread (renderer) sink. Worker realms are bridged in as `worker:<n>`. */
export const RENDERER_REALM = "renderer";

export const TELEMETRY_WINDOW_KEY: LichtblickTelemetryWindowKey = "lichtblickTelemetry";
