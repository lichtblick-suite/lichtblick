// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder, defaults } from "@lichtblick/test-builders";

import { TELEMETRY_EVENT_NAMES, TELEMETRY_SCOPES, TELEMETRY_UNITS } from "./constants";
import { TelemetryMock } from "./types";
import { TelemetryBatch, TelemetryEvent, TelemetrySample } from "../types";

// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TelemetryBuilder {
  public static realm(): string {
    return `worker:${BasicBuilder.string()}`;
  }

  public static metric(): string {
    return `test.${BasicBuilder.string()}`;
  }

  public static sample(props: Partial<TelemetrySample> = {}): TelemetrySample {
    return defaults<TelemetrySample>(props, {
      kind: "sample",
      realm: TelemetryBuilder.realm(),
      sequence: BasicBuilder.number({ min: 0, max: 1000 }),
      monotonicTs: BasicBuilder.float(1, 1e12),
      metric: TelemetryBuilder.metric(),
      value: BasicBuilder.number(),
      unit: BasicBuilder.sample(TELEMETRY_UNITS),
      scope: BasicBuilder.sample(TELEMETRY_SCOPES),
      metricType: "gauge",
    });
  }

  public static event(props: Partial<TelemetryEvent> = {}): TelemetryEvent {
    return defaults<TelemetryEvent>(props, {
      kind: "event",
      realm: TelemetryBuilder.realm(),
      sequence: BasicBuilder.number({ min: 0, max: 1000 }),
      monotonicTs: BasicBuilder.float(1, 1e12),
      name: BasicBuilder.sample(TELEMETRY_EVENT_NAMES),
      phase: "instant",
      scope: BasicBuilder.sample(TELEMETRY_SCOPES),
    });
  }

  public static batch(props: Partial<TelemetryBatch> = {}): TelemetryBatch {
    const realm = props.realm ?? TelemetryBuilder.realm();
    return defaults<TelemetryBatch>(props, {
      realm,
      records: [
        TelemetryBuilder.sample({ realm, sequence: 0 }),
        TelemetryBuilder.event({ realm, sequence: 1 }),
      ],
      dropped: 0,
    });
  }

  /**
   * Telemetry double whose methods are all `jest.fn()` mocks. `isEnabled()` returns `enabled`
   * (default `true`). Test-only: requires the jest globals.
   */
  public static mockTelemetry({ enabled }: { enabled?: boolean } = {}): TelemetryMock {
    return {
      isEnabled: jest.fn(() => enabled ?? true),
      gauge: jest.fn(),
      counter: jest.fn(),
      observe: jest.fn(),
      event: jest.fn(),
      ingest: jest.fn(),
    };
  }
}
