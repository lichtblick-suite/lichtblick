// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import InitializationSourceBuilder from "@lichtblick/suite-base/testing/builders/InitializationSourceBuilder";
import {
  BufferedTelemetrySink,
  getTelemetry,
  setTelemetrySink,
} from "@lichtblick/suite-base/util/telemetry";

import type { IIterableSource, ISerializedIterableSource, Initialization } from "./IIterableSource";
import { WorkerSerializedIterableSourceWorker } from "./WorkerSerializedIterableSourceWorker";
import { HydratedSourcePool } from "./shared/HydratedSourcePool";
import { MultiIterableSource } from "./shared/MultiIterableSource";
import { latestSamplesByMetric } from "./testing/telemetryTestUtils";

/**
 * Minimal serialized source that, like MultiIterableSource, constructs a HydratedSourcePool during
 * initialize() (so it captures the realm sink at that moment) and tears it down on terminate().
 */
class PoolBackedSource implements ISerializedIterableSource {
  public readonly sourceType = "serialized";
  public pool: HydratedSourcePool | undefined;

  public async initialize(): Promise<Initialization> {
    this.pool = new HydratedSourcePool({ maxCount: 1, poolId: "multi" });
    await this.pool.acquire(
      {},
      {
        open: async () => "reader",
        close: async () => {},
      },
    );
    return {} as Initialization;
  }

  public async *messageIterator(): AsyncIterableIterator<never> {}

  public async getBackfillMessages(): Promise<never[]> {
    return [];
  }

  public async terminate(): Promise<void> {
    await this.pool?.terminate();
  }
}

describe("WorkerSerializedIterableSourceWorker telemetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    setTelemetrySink(undefined);
    jest.useRealTimers();
  });

  it("returns undefined from drainTelemetry() when telemetry was never enabled", () => {
    // Given
    const worker = new WorkerSerializedIterableSourceWorker(new PoolBackedSource());

    // When
    const batch = worker.drainTelemetry();

    // Then
    expect(batch).toBeUndefined();
    expect(getTelemetry().isEnabled()).toBe(false);
  });

  it("installs a started realm sink once and drains its records with the given realm", () => {
    // Given
    const worker = new WorkerSerializedIterableSourceWorker(new PoolBackedSource());

    // When
    worker.enableTelemetry("worker:7");
    const sink = getTelemetry();
    worker.enableTelemetry("worker:8");
    getTelemetry().event("preload", "start", "worker");
    const batch = worker.drainTelemetry();

    // Then
    expect(sink.isEnabled()).toBe(true);
    expect(getTelemetry()).toBe(sink);
    // The sink's publish timer is running.
    expect(jest.getTimerCount()).toBe(1);
    expect(batch?.realm).toBe("worker:7");
    expect(batch?.records).toEqual([
      expect.objectContaining({ kind: "event", name: "preload", realm: "worker:7" }),
    ]);
  });

  it("lets a pool created during initialize() report through the worker sink, flushes on terminate and disposes on the final drain", async () => {
    // Given: telemetry enabled before initialize(), as done by WorkerSerializedIterableSource.
    const worker = new WorkerSerializedIterableSourceWorker(new PoolBackedSource());
    worker.enableTelemetry("worker:1");
    await worker.initialize();
    worker.drainTelemetry();

    // When
    await worker.terminate();
    const finalBatch = worker.drainTelemetry();

    // Then: the final pool counters are in the final batch...
    const terminatedPins = finalBatch?.records.find(
      (record) =>
        record.kind === "sample" && record.metric === "pipeline.hydratedSourcePool.terminatedPins",
    );
    expect(terminatedPins).toMatchObject({ value: 1, labels: { poolId: "multi" } });
    // ...and the sink is disposed: realm reverted to no-op, no timer left behind.
    expect(getTelemetry().isEnabled()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should flush the final pool counters even when the source's terminate() rejects", async () => {
    // Given
    const source = new PoolBackedSource();
    const worker = new WorkerSerializedIterableSourceWorker(source);
    worker.enableTelemetry("worker:1");
    await worker.initialize();
    worker.drainTelemetry();
    jest.spyOn(source, "terminate").mockImplementation(async () => {
      await source.pool?.terminate();
      throw new Error("terminate failed");
    });

    // When
    await expect(worker.terminate()).rejects.toThrow("terminate failed");
    const finalBatch = worker.drainTelemetry();

    // Then
    const activePins = finalBatch?.records.find(
      (record) =>
        record.kind === "sample" && record.metric === "pipeline.hydratedSourcePool.activePins",
    );
    expect(activePins).toMatchObject({ value: 0, realm: "worker:1" });
    expect(getTelemetry().isEnabled()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should keep realm sequences contiguous across periodic drains and the final drain", async () => {
    // Given
    const worker = new WorkerSerializedIterableSourceWorker(new PoolBackedSource());
    worker.enableTelemetry("worker:3");
    await worker.initialize();

    // When: periodic publishes (1 Hz sink timer) drained in between, then terminate + final drain
    const batches = [worker.drainTelemetry()];
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(1000);
      batches.push(worker.drainTelemetry());
    }
    await worker.terminate();
    batches.push(worker.drainTelemetry());
    const afterFinal = worker.drainTelemetry();

    // Then
    const sequences = batches.flatMap((batch) => batch?.records.map((r) => r.sequence) ?? []);
    expect(sequences.length).toBeGreaterThan(0);
    expect(sequences).toEqual(sequences.map((_, i) => i));
    expect(batches.every((batch) => batch?.realm === "worker:3" && batch.dropped === 0)).toBe(true);
    expect(afterFinal).toEqual({ realm: "worker:3", records: [], dropped: 0 });
  });

  it("does not enable telemetry after terminate()", async () => {
    // Given
    const worker = new WorkerSerializedIterableSourceWorker(new PoolBackedSource());
    await worker.terminate();

    // When
    worker.enableTelemetry("worker:1");

    // Then
    expect(getTelemetry().isEnabled()).toBe(false);
    expect(worker.drainTelemetry()).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should forward metrics of worker-side sources constructed before enableTelemetry() to the main sink", async () => {
    // Given: like McapIterableSourceWorker's initialize(), the MultiIterableSource is constructed
    // before the main thread enables the worker realm sink.
    const SourceConstructor = jest.fn().mockImplementation(
      () =>
        ({
          initialize: jest.fn().mockResolvedValue(InitializationSourceBuilder.initialization()),
          messageIterator: jest.fn(),
          getBackfillMessages: jest.fn().mockResolvedValue([]),
          getStart: jest.fn().mockReturnValue({ sec: 0, nsec: 0 }),
          getEnd: jest.fn().mockReturnValue({ sec: 10, nsec: 0 }),
        }) as jest.Mocked<IIterableSource>,
    );
    const multiSource = new MultiIterableSource(
      { type: "files", files: [new Blob(), new Blob()] },
      SourceConstructor,
    );
    const worker = new WorkerSerializedIterableSourceWorker(multiSource);
    const mainSink = new BufferedTelemetrySink({
      realm: "renderer",
      setInterval: jest.fn(),
      clearInterval: jest.fn(),
    });

    // When: enable → initialize → backfill in the worker, one 1 Hz publish, then drain + ingest
    // on the main side as the WorkerSerializedIterableSource bridge does
    worker.enableTelemetry("worker:4");
    await worker.initialize();
    await worker.getBackfillMessages({ topics: new Map(), time: { sec: 5, nsec: 0 } });
    jest.advanceTimersByTime(1000);
    const batch = worker.drainTelemetry();
    mainSink.ingest(batch!);

    // Then: the worker-realm samples arrive unchanged in the main sink
    const samples = latestSamplesByMetric(mainSink.drain().records);
    expect(samples.get("pipeline.sources.total")).toMatchObject({
      value: 2,
      realm: "worker:4",
      scope: "pipeline",
    });
    expect(samples.get("pipeline.sources.relevant")).toMatchObject({
      value: 2,
      realm: "worker:4",
    });
  });
});
