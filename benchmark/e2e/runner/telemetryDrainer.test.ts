// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { DRAIN_BATCH_SIZE, MAX_TELEMETRY_DRAIN_ITERATIONS } from "./constants";
import { TelemetryDrainer, drainUntilEmpty } from "./telemetryDrainer";
import type { TelemetryBatch, TelemetryRecord } from "../result/schemaV1";

function record(sequence: number): TelemetryRecord {
  return {
    kind: "event",
    realm: "renderer",
    sequence,
    monotonicTs: sequence,
    scope: "app",
    name: "app.ready",
    phase: "instant",
  };
}

/** A page whose `lichtblickTelemetry.drain()` returns `batches` in order, then empty batches. */
function fakePage(batches: TelemetryBatch[]): Page {
  const evaluate = jest.fn(async () => batches.shift() ?? batchOf(0));
  return { evaluate } as unknown as Page;
}

function batchOf(count: number, dropped = 0): TelemetryBatch {
  return {
    realm: "renderer",
    dropped,
    records: Array.from({ length: count }, (_, i) => record(i)),
  };
}

describe("TelemetryDrainer.drain", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should keep draining full batches and stop at the first partial batch", async () => {
    // Given
    const page = fakePage([batchOf(DRAIN_BATCH_SIZE), batchOf(3, 2), batchOf(5)]);
    const drainer = new TelemetryDrainer(page);

    // When
    const received = await drainer.drain();

    // Then
    expect({ received, dropped: drainer.dropped }).toEqual({
      received: DRAIN_BATCH_SIZE + 3,
      dropped: 2,
    });
  });
});

describe("drainUntilEmpty", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should stop without a warning when a drain returns no record", async () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const drainer = new TelemetryDrainer(fakePage([batchOf(3), batchOf(0)]));

    // When
    await drainUntilEmpty(drainer);

    // Then
    expect(warn).not.toHaveBeenCalled();
  });

  it("should collect every record drained before the empty drain", async () => {
    // Given
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const drainer = new TelemetryDrainer(fakePage([batchOf(3), batchOf(2)]));

    // When
    await drainUntilEmpty(drainer);

    // Then
    expect(drainer.records).toHaveLength(5);
  });

  it("should stop at the iteration bound when the page never drains empty", async () => {
    // Given
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const drainer = new TelemetryDrainer(fakePage([]));
    const drain = jest.spyOn(drainer, "drain").mockResolvedValue(1);

    // When
    await drainUntilEmpty(drainer);

    // Then
    expect(drain).toHaveBeenCalledTimes(MAX_TELEMETRY_DRAIN_ITERATIONS);
  });

  it("should warn once with the bound when it stops with records still pending", async () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const drainer = new TelemetryDrainer(fakePage([]));
    jest.spyOn(drainer, "drain").mockResolvedValue(1);

    // When
    await drainUntilEmpty(drainer);

    // Then
    expect(warn.mock.calls).toEqual([
      [expect.stringContaining(`stopped after ${MAX_TELEMETRY_DRAIN_ITERATIONS} iterations`)],
    ]);
  });
});
