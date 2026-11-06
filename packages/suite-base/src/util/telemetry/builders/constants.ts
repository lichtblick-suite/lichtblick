// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryEventName, TelemetryScope, TelemetryUnit } from "../types";

/** Event names `TelemetryBuilder.event()` samples from. */
export const TELEMETRY_EVENT_NAMES: TelemetryEventName[] = [
  "app.ready",
  "datasource.open",
  "datasource.firstMessage",
  "frame.firstUseful",
  "preload",
  "playback",
  "seek.requested",
  "datasource.close",
  "layout.applied",
  "panel.mount",
  "panel.unmount",
  "panel.firstRender",
];

/** Units `TelemetryBuilder` samples from. */
export const TELEMETRY_UNITS: TelemetryUnit[] = ["bytes", "count", "ms", "percent", "fps", "ratio"];

/** Scopes `TelemetryBuilder` samples from. */
export const TELEMETRY_SCOPES: TelemetryScope[] = [
  "process",
  "renderer",
  "worker",
  "pipeline",
  "panel",
  "app",
];
