// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { UaSpecificMemoryCollector } from "./UaSpecificMemoryCollector";
import { buildMockTelemetry, MockTelemetry } from "./builders/RendererCollectorsEnvBuilder";
import { UserAgentSpecificMemoryResult } from "./types";

const mockLogDebug = jest.fn();

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: {
    getLogger: () => ({
      debug: (...args: unknown[]) => mockLogDebug(...args),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

type Deferred = {
  promise: Promise<UserAgentSpecificMemoryResult>;
  resolve: (result: UserAgentSpecificMemoryResult) => void;
  reject: (err: Error) => void;
};

function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<UserAgentSpecificMemoryResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function setup(options: { crossOriginIsolated?: boolean; withApi?: boolean } = {}): {
  telemetry: MockTelemetry;
  measure: jest.Mock<Promise<UserAgentSpecificMemoryResult>, []>;
  pending: Deferred[];
  clock: { now: number };
  collector: UaSpecificMemoryCollector;
} {
  const telemetry = buildMockTelemetry();
  const pending: Deferred[] = [];
  const measure = jest.fn(async () => {
    const d = deferred();
    pending.push(d);
    return await d.promise;
  });
  const clock = { now: 0 };
  const collector = new UaSpecificMemoryCollector(telemetry, {
    now: () => clock.now,
    performance: options.withApi === false ? {} : { measureUserAgentSpecificMemory: measure },
    crossOriginIsolated: options.crossOriginIsolated ?? true,
  });
  return { telemetry, measure, pending, clock, collector };
}

describe("UaSpecificMemoryCollector", () => {
  it("should publish the measured bytes as a gauge", async () => {
    // Given
    const { telemetry, pending, collector } = setup();

    // When
    collector.measure();
    pending[0]!.resolve({ bytes: 1234 });
    await flushPromises();

    // Then
    expect(telemetry.gauge).toHaveBeenCalledWith(
      "renderer.uaSpecificMemory.bytes",
      1234,
      "bytes",
      "renderer",
    );
  });

  it("should never have more than one measurement in flight and coalesce requests", async () => {
    // Given
    const { measure, pending, collector } = setup();
    collector.measure();

    // When
    collector.measure();
    collector.measure();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);

    // When the first settles, exactly one coalesced follow-up starts
    pending[0]!.resolve({ bytes: 1 });
    await flushPromises();

    // Then
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it("should space periodic measurements at least 10 s apart", async () => {
    // Given
    const { measure, pending, clock, collector } = setup();
    collector.measure();
    pending[0]!.resolve({ bytes: 1 });
    await flushPromises();

    // When
    clock.now = 9_999;
    collector.maybeMeasurePeriodic();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);

    // When
    clock.now = 10_000;
    collector.maybeMeasurePeriodic();

    // Then
    expect(measure).toHaveBeenCalledTimes(2);
  });

  it("should swallow measurement errors", async () => {
    // Given
    const { telemetry, pending, collector } = setup();

    // When
    collector.measure();
    pending[0]!.reject(new Error("SecurityError"));
    await flushPromises();

    // Then
    expect(telemetry.gauge).not.toHaveBeenCalled();
    expect(mockLogDebug).toHaveBeenCalled();
  });

  const unsupportedCases: ReadonlyArray<{
    label: string;
    crossOriginIsolated?: boolean;
    withApi?: boolean;
  }> = [
    { label: "not cross-origin isolated", crossOriginIsolated: false },
    { label: "API missing", withApi: false },
  ];
  it.each(unsupportedCases)("should do nothing when $label", ({ crossOriginIsolated, withApi }) => {
    // Given
    const { measure, collector } = setup({ crossOriginIsolated, withApi });

    // When
    collector.measure();
    collector.maybeMeasurePeriodic();

    // Then
    expect(collector.isSupported()).toBe(false);
    expect(measure).not.toHaveBeenCalled();
  });

  it("should not record or start new measurements after dispose", async () => {
    // Given
    const { telemetry, measure, pending, collector } = setup();
    collector.measure();
    collector.measure();

    // When
    collector.dispose();
    pending[0]!.resolve({ bytes: 1 });
    await flushPromises();
    collector.measure();

    // Then
    expect(measure).toHaveBeenCalledTimes(1);
    expect(telemetry.gauge).not.toHaveBeenCalled();
  });
});
