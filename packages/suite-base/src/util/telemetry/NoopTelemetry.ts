// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  ITelemetry,
  TelemetryBatch,
  TelemetryEventName,
  TelemetryLabels,
  TelemetryPhase,
  TelemetryScope,
  TelemetryUnit,
} from "./types";

/** Telemetry implementation that records nothing. Default sink in every realm. */
export class NoopTelemetry implements ITelemetry {
  public isEnabled(): boolean {
    return false;
  }

  public gauge(
    _metric: string,
    _value: number,
    _unit: TelemetryUnit,
    _scope: TelemetryScope,
    _labels?: TelemetryLabels,
  ): void {
    // Intentionally empty: telemetry disabled.
  }

  public counter(
    _metric: string,
    _increment: number,
    _unit: TelemetryUnit,
    _scope: TelemetryScope,
    _labels?: TelemetryLabels,
  ): void {
    // Intentionally empty: telemetry disabled.
  }

  public observe(
    _metric: string,
    _value: number,
    _unit: TelemetryUnit,
    _scope: TelemetryScope,
    _labels?: TelemetryLabels,
  ): void {
    // Intentionally empty: telemetry disabled.
  }

  public event(
    _name: TelemetryEventName,
    _phase: TelemetryPhase,
    _scope: TelemetryScope,
    _labels?: TelemetryLabels,
  ): void {
    // Intentionally empty: telemetry disabled.
  }

  public ingest(_batch: TelemetryBatch): void {
    // Intentionally empty: telemetry disabled.
  }
}

export const NOOP_TELEMETRY: ITelemetry = new NoopTelemetry();
