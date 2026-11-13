// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BufferedTelemetrySink,
  setTelemetrySink,
  type TelemetryRecord,
  type TelemetrySample,
} from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";

import { HydratedSourcePool, SourceHydrator } from "./HydratedSourcePool";
import type { HydratedSourcePoolOptions, HydratedSourcePoolStats } from "./types";

type MockHydrator = SourceHydrator<unknown> & { open: jest.Mock; close: jest.Mock };

function makeHydrator(value: unknown, weight?: number): MockHydrator {
  const hydrator: MockHydrator = {
    open: jest.fn().mockResolvedValue(value),
    close: jest.fn().mockResolvedValue(undefined),
  };
  if (weight != undefined) {
    hydrator.weigh = jest.fn().mockReturnValue(weight);
  }
  return hydrator;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve: (value: T) => void = () => {};
  let reject: (err: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function expectInvariant(stats: HydratedSourcePoolStats): void {
  expect(stats.acquires - stats.releases - stats.terminatedPins).toBe(stats.activePins);
}

// Flush the fire-and-forget eviction pass started by release().
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function makeClock(start = 1000): { now: () => number; advance: (ms: number) => void } {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function makeSink(): BufferedTelemetrySink {
  return new BufferedTelemetrySink({
    realm: "test",
    setInterval: jest.fn(),
    clearInterval: jest.fn(),
  });
}

function poolSamples(records: TelemetryRecord[]): Map<string, TelemetryRecord[]> {
  const byMetric = new Map<string, TelemetryRecord[]>();
  for (const record of records) {
    if (record.kind !== "sample" || !record.metric.startsWith("pipeline.hydratedSourcePool.")) {
      continue;
    }
    const key = record.metric.slice("pipeline.hydratedSourcePool.".length);
    byMetric.set(key, [...(byMetric.get(key) ?? []), record]);
  }
  return byMetric;
}

describe("HydratedSourcePool stats", () => {
  afterEach(() => {
    setTelemetrySink(undefined);
  });

  it("starts with all-zero stats", () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 2 });

    // When
    const stats = pool.getStats();

    // Then
    expect(stats).toEqual({
      residentCount: 0,
      residentBytes: 0,
      pinnedEntries: 0,
      activePins: 0,
      acquires: 0,
      releases: 0,
      terminatedPins: 0,
      opens: 0,
      rehydrations: 0,
      admits: 0,
      closes: 0,
      evictions: 0,
      failures: 0,
      overBudget: false,
      overBudgetPeriods: 0,
      overBudgetDurationMs: 0,
      highWaterResidentCount: 0,
      highWaterResidentBytes: 0,
      highWaterActivePins: 0,
    });
  });

  it("counts resident hits and new hydrations and keeps the pin invariant", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 4 });
    const admitted = {};
    const hydrated = {};
    const admittedHydrator = makeHydrator("A", 10);
    const hydratedHydrator = makeHydrator("B", 20);
    await pool.admit(admitted, admittedHydrator, "A");

    // When
    await pool.acquire(admitted, admittedHydrator); // resident hit
    await pool.acquire(hydrated, hydratedHydrator); // new hydration
    const whilePinned = pool.getStats();
    pool.release(admitted);
    pool.release(hydrated);
    await flushMicrotasks();
    const afterRelease = pool.getStats();

    // Then
    expect(whilePinned).toMatchObject({
      admits: 1,
      acquires: 2,
      opens: 1,
      activePins: 2,
      pinnedEntries: 2,
      residentCount: 2,
      residentBytes: 30,
    });
    expectInvariant(whilePinned);
    expect(afterRelease).toMatchObject({ releases: 2, activePins: 0, pinnedEntries: 0 });
    expectInvariant(afterRelease);
  });

  it("keeps the invariant while concurrent acquires are pending on the same hydration", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 4 });
    const token = {};
    const open = deferred<unknown>();
    const hydrator = makeHydrator(undefined);
    hydrator.open.mockReturnValue(open.promise);

    // When
    const first = pool.acquire(token, hydrator);
    const second = pool.acquire(token, hydrator);
    const pending = pool.getStats();
    open.resolve("value");
    await Promise.all([first, second]);
    const resolved = pool.getStats();

    // Then
    expect(pending).toMatchObject({ acquires: 2, activePins: 2, opens: 1, residentCount: 1 });
    expectInvariant(pending);
    expect(resolved).toMatchObject({ acquires: 2, activePins: 2, highWaterActivePins: 2 });
    expectInvariant(resolved);
  });

  it("counts every caller of a failed hydration as a failure and a release", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 4 });
    const token = {};
    const open = deferred<unknown>();
    const hydrator = makeHydrator(undefined);
    hydrator.open.mockReturnValue(open.promise);
    const first = pool.acquire(token, hydrator);
    const second = pool.acquire(token, hydrator);

    // When
    open.reject(new Error("open failed"));
    const results = await Promise.allSettled([first, second]);
    const stats = pool.getStats();

    // Then
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(stats).toMatchObject({
      acquires: 2,
      releases: 2,
      failures: 2,
      activePins: 0,
      residentCount: 0,
    });
    expectInvariant(stats);
  });

  it("does not count release() of an unknown token or of an unpinned entry", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 4 });
    const token = {};
    await pool.admit(token, makeHydrator("A"), "A");

    // When
    pool.release({});
    pool.release(token);
    await flushMicrotasks();
    const stats = pool.getStats();

    // Then
    expect(stats.releases).toBe(0);
    expectInvariant(stats);
  });

  it("moves outstanding pins to terminatedPins on terminate", async () => {
    // Given: one resolved pinned entry and one pending hydration.
    const pool = new HydratedSourcePool({ maxCount: 4 });
    const resolvedToken = {};
    const pendingToken = {};
    const resolvedHydrator = makeHydrator("A");
    await pool.acquire(resolvedToken, resolvedHydrator);
    const open = deferred<unknown>();
    const pendingHydrator = makeHydrator(undefined);
    pendingHydrator.open.mockReturnValue(open.promise);
    const pending = pool.acquire(pendingToken, pendingHydrator);

    // When
    const terminating = pool.terminate();
    const afterTerminateCall = pool.getStats();
    open.reject(new Error("aborted"));
    await expect(pending).rejects.toThrow("aborted");
    await terminating;
    const final = pool.getStats();

    // Then
    expect(afterTerminateCall).toMatchObject({
      acquires: 2,
      terminatedPins: 2,
      activePins: 0,
      residentCount: 0,
    });
    expectInvariant(afterTerminateCall);
    // The late rollback counts as a failure but not as a release (already terminated).
    expect(final).toMatchObject({ releases: 0, failures: 1, terminatedPins: 2, closes: 1 });
    expectInvariant(final);
    // Releasing after terminate is a no-op.
    pool.release(resolvedToken);
    expectInvariant(pool.getStats());
    // terminate() logs the pending entry whose hydration rejected (expected here).
    expect((console.error as jest.Mock).mock.calls[0]?.[0]).toBe(
      "HydratedSourcePool terminate close failed",
    );
    (console.error as jest.Mock).mockClear();
  });

  it("counts evictions, closes and re-hydrations of previously evicted tokens", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 1 });
    const tokenA = {};
    const tokenB = {};
    const hydratorA = makeHydrator("A");
    const hydratorB = makeHydrator("B");
    await pool.acquire(tokenA, hydratorA);
    pool.release(tokenA);

    // When: B evicts A, then A is re-hydrated (evicting B).
    await pool.acquire(tokenB, hydratorB);
    pool.release(tokenB);
    await pool.acquire(tokenA, hydratorA);
    pool.release(tokenA);
    await flushMicrotasks();
    const stats = pool.getStats();

    // Then
    expect(stats).toMatchObject({
      opens: 3,
      rehydrations: 1,
      evictions: 2,
      closes: 2,
      residentCount: 1,
    });
    expectInvariant(stats);
  });

  it("tracks over-budget periods and accumulates their duration", async () => {
    // Given: a count cap of 1 and an injected clock.
    const clock = makeClock();
    const pool = new HydratedSourcePool({ maxCount: 1, now: clock.now });
    const tokenA = {};
    const tokenB = {};
    await pool.acquire(tokenA, makeHydrator("A"));

    // When: a second pinned entry cannot be evicted.
    await pool.acquire(tokenB, makeHydrator("B"));
    const entered = pool.getStats();
    clock.advance(250);
    const during = pool.getStats();
    pool.release(tokenA);
    await flushMicrotasks();
    const exited = pool.getStats();
    clock.advance(1000);
    const later = pool.getStats();

    // Then
    expect(entered).toMatchObject({ overBudget: true, overBudgetPeriods: 1 });
    expect(entered.overBudgetDurationMs).toBe(0);
    expect(during.overBudgetDurationMs).toBe(250);
    expect(exited).toMatchObject({ overBudget: false, overBudgetPeriods: 1, evictions: 1 });
    expect(exited.overBudgetDurationMs).toBe(250);
    expect(later.overBudgetDurationMs).toBe(250);
  });

  it("should leave the over-budget state as soon as the victim is evicted, before its close settles", async () => {
    // Given: a count cap of 1, two pinned entries (over budget), and a victim whose close never
    // resolves
    const clock = makeClock();
    const pool = new HydratedSourcePool({ maxCount: 1, now: clock.now });
    const tokenA = {};
    const tokenB = {};
    const slowHydrator = makeHydrator("A");
    slowHydrator.close.mockReturnValue(new Promise<void>(() => {}));
    await pool.acquire(tokenA, slowHydrator);
    await pool.acquire(tokenB, makeHydrator("B"));
    clock.advance(250);

    // When: the first entry is released and evicted, but its close is still pending
    pool.release(tokenA);
    const afterEviction = pool.getStats();
    clock.advance(1000);
    await flushMicrotasks();
    const later = pool.getStats();

    // Then
    expect(afterEviction).toMatchObject({ overBudget: false, residentCount: 1, evictions: 1 });
    expect(later.overBudgetDurationMs).toBe(250);
    expect(slowHydrator.close).toHaveBeenCalledTimes(1);
  });

  it("accumulates over-budget duration across several periods and closes the period on terminate", async () => {
    // Given
    const clock = makeClock();
    const pool = new HydratedSourcePool({ maxBytes: 100, now: clock.now });
    const tokenA = {};
    const tokenB = {};
    await pool.acquire(tokenA, makeHydrator("A", 80));

    // When: first period (100 ms) ends by release + eviction.
    await pool.acquire(tokenB, makeHydrator("B", 80));
    clock.advance(100);
    pool.release(tokenA);
    await flushMicrotasks();
    // Second period (40 ms) ends by terminate.
    await pool.acquire(tokenA, makeHydrator("A", 80));
    clock.advance(40);
    await pool.terminate();
    const stats = pool.getStats();

    // Then
    expect(stats).toMatchObject({ overBudget: false, overBudgetPeriods: 2 });
    expect(stats.overBudgetDurationMs).toBe(140);
  });

  it("records high-water marks", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 2 });
    const tokens = [{}, {}, {}];

    // When: three pinned entries exceed the cap, then everything is released and evicted.
    for (const [i, token] of tokens.entries()) {
      await pool.acquire(token, makeHydrator(`v${i}`, 10));
    }
    for (const token of tokens) {
      pool.release(token);
    }
    await flushMicrotasks();
    const stats = pool.getStats();

    // Then
    expect(stats).toMatchObject({
      residentCount: 2,
      residentBytes: 20,
      highWaterResidentCount: 3,
      highWaterResidentBytes: 30,
      highWaterActivePins: 3,
    });
    expectInvariant(stats);
  });

  it("should keep counters non-negative and the pin invariant under concurrency, failures and terminate", async () => {
    // Given: 5 tokens, each acquired twice concurrently while its hydration is pending.
    const pool = new HydratedSourcePool({ maxCount: 2 });
    const tokens = [{}, {}, {}, {}, {}];
    const opens = tokens.map(() => deferred<unknown>());
    const hydrators = opens.map((open) => {
      const hydrator = makeHydrator(undefined, 10);
      hydrator.open.mockReturnValue(open.promise);
      return hydrator;
    });
    const snapshots: HydratedSourcePoolStats[] = [];
    const snapshot = () => snapshots.push(pool.getStats());
    const acquisitions: Array<Promise<unknown>> = [];
    for (const [i, token] of tokens.entries()) {
      acquisitions.push(pool.acquire(token, hydrators[i]!));
      snapshot();
      acquisitions.push(pool.acquire(token, hydrators[i]!));
      snapshot();
    }

    // When: token 0/2 hydrate, token 1 fails; token 0 is released (plus one extra release);
    // the pool is terminated while token 3/4 are still pending; then token 3 fails, 4 resolves.
    opens[0]!.resolve("v0");
    opens[1]!.reject(new Error("fail-1"));
    opens[2]!.resolve("v2");
    await Promise.allSettled(acquisitions.slice(0, 6));
    snapshot();
    pool.release(tokens[0]!);
    snapshot();
    pool.release(tokens[0]!);
    snapshot();
    pool.release(tokens[0]!);
    snapshot();
    await flushMicrotasks();
    snapshot();
    const terminating = pool.terminate();
    snapshot();
    opens[3]!.reject(new Error("fail-3"));
    opens[4]!.resolve("v4");
    await Promise.allSettled(acquisitions);
    await terminating;
    snapshot();
    pool.release(tokens[2]!);
    snapshot();

    // Then
    for (const stats of snapshots) {
      expectInvariant(stats);
      const numbers = Object.values(stats).filter(
        (value): value is number => typeof value === "number",
      );
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
      expect(stats.pinnedEntries).toBeLessThanOrEqual(stats.activePins);
      expect(stats.highWaterActivePins).toBeGreaterThanOrEqual(stats.activePins);
    }
    expect(snapshots.at(-1)).toMatchObject({
      acquires: 10,
      // token 0: 2 releases, token 1: 2 rollbacks before terminate
      releases: 4,
      // token 2, 3, 4: 2 pins each were outstanding at terminate
      terminatedPins: 6,
      // token 1 (before terminate) and token 3 (after terminate): 2 callers each
      failures: 4,
      activePins: 0,
      residentCount: 0,
      residentBytes: 0,
      pinnedEntries: 0,
      highWaterActivePins: 10,
    });
    // terminate() logs the pending entry whose hydration rejected (expected here).
    expect(console.error).toHaveBeenCalledTimes(1);
    expect((console.error as jest.Mock).mock.calls[0]?.[0]).toBe(
      "HydratedSourcePool terminate close failed",
    );
    (console.error as jest.Mock).mockClear();
  });

  it("should count every re-hydration of tokens that are evicted repeatedly", async () => {
    // Given
    const pool = new HydratedSourcePool({ maxCount: 1 });
    const tokenA = {};
    const tokenB = {};
    const hydratorA = makeHydrator("A");
    const hydratorB = makeHydrator("B");

    // When: A, B, A, B, A with a count cap of 1 (each acquire evicts the other token)
    for (const [token, hydrator] of [
      [tokenA, hydratorA],
      [tokenB, hydratorB],
      [tokenA, hydratorA],
      [tokenB, hydratorB],
      [tokenA, hydratorA],
    ] as const) {
      await pool.acquire(token, hydrator);
      pool.release(token);
      await flushMicrotasks();
    }
    const stats = pool.getStats();

    // Then
    expect(stats).toMatchObject({ opens: 5, rehydrations: 3, evictions: 4, closes: 4 });
    expect(stats.rehydrations).toBeLessThanOrEqual(stats.opens);
    expectInvariant(stats);
  });

  it("should report over budget when minResident protects a single entry heavier than maxBytes", async () => {
    // Given
    const clock = makeClock();
    const pool = new HydratedSourcePool({ maxBytes: 10, now: clock.now });
    const token = {};

    // When
    await pool.admit(token, makeHydrator("A"), "A");
    const lightStats = pool.getStats();
    await pool.terminate();
    const heavyPool = new HydratedSourcePool({ maxBytes: 10, now: clock.now });
    await heavyPool.admit(token, makeHydrator("B", 50), "B");
    clock.advance(75);
    const heavyStats = heavyPool.getStats();

    // Then: the floor keeps the entry resident, so the pool stays over budget without evicting.
    expect(lightStats).toMatchObject({ overBudget: false, overBudgetPeriods: 0 });
    expect(heavyStats).toMatchObject({
      overBudget: true,
      overBudgetPeriods: 1,
      overBudgetDurationMs: 75,
      evictions: 0,
      residentCount: 1,
      highWaterResidentBytes: 50,
    });
  });

  describe("telemetry", () => {
    it("should publish counter deltas that sum to the getStats() totals across many publishes", async () => {
      // Given
      const sink = makeSink();
      const clock = makeClock();
      const pool = new HydratedSourcePool({ maxCount: 1, telemetry: sink, now: clock.now });
      const tokens = [{}, {}, {}];
      const failing = makeHydrator(undefined);
      failing.open.mockRejectedValue(new Error("open failed"));

      // When: a mix of hits, evictions, re-hydrations, failures, over-budget time and terminate,
      // with a sink publish after every step.
      for (let round = 0; round < 3; round++) {
        for (const token of tokens) {
          await pool.acquire(token, makeHydrator(`v${round}`, 5));
          sink.publishNow();
          clock.advance(10);
        }
        for (const token of tokens) {
          pool.release(token);
          await flushMicrotasks();
          sink.publishNow();
        }
        await expect(pool.acquire({}, failing)).rejects.toThrow("open failed");
        sink.publishNow();
      }
      await pool.acquire(tokens[0]!, makeHydrator("last", 5));
      await pool.terminate();
      sink.publishNow();
      const stats = pool.getStats();
      const samples = poolSamples(sink.drain().records);

      // Then
      const counterNames = [
        "acquires",
        "releases",
        "terminatedPins",
        "opens",
        "rehydrations",
        "admits",
        "closes",
        "evictions",
        "failures",
        "overBudgetPeriods",
        "overBudgetDurationMs",
      ] as const;
      for (const name of counterNames) {
        const series = (samples.get(name) ?? []).filter(
          (record): record is TelemetrySample => record.kind === "sample",
        );
        let deltaSum = 0;
        for (const sample of series) {
          expect(sample.metricType).toBe("counter");
          expect(sample.delta).toBeGreaterThanOrEqual(0);
          deltaSum += sample.delta ?? 0;
        }
        expect({ name, deltaSum, last: series.at(-1)?.value }).toEqual({
          name,
          deltaSum: stats[name],
          last: stats[name],
        });
      }
      expect(stats.failures).toBe(3);
      expect(stats.overBudgetDurationMs).toBeGreaterThan(0);
    });

    it("should publish zeroed pin and residency gauges after terminate", async () => {
      // Given
      const sink = makeSink();
      const pool = new HydratedSourcePool({ maxCount: 1, telemetry: sink, poolId: "multi" });
      await pool.acquire({}, makeHydrator("A", 3));
      await pool.acquire({}, makeHydrator("B", 4));

      // When
      await pool.terminate();
      sink.publishNow();
      const samples = poolSamples(sink.drain().records);

      // Then
      const last = (name: string) => samples.get(name)?.at(-1);
      expect(last("activePins")).toMatchObject({ value: 0 });
      expect(last("pinnedEntries")).toMatchObject({ value: 0 });
      expect(last("residentCount")).toMatchObject({ value: 0 });
      expect(last("residentBytes")).toMatchObject({ value: 0 });
      expect(last("overBudget")).toMatchObject({ value: 0 });
      expect(last("terminatedPins")).toMatchObject({ value: 2 });
      expect(last("highWaterActivePins")).toMatchObject({ value: 2 });
    });

    it("should keep a stable poolId per pool and distinct default poolIds across pools", async () => {
      // Given
      const sinkA = makeSink();
      const sinkB = makeSink();
      const poolA = new HydratedSourcePool({ maxCount: 1, telemetry: sinkA });
      const poolB = new HydratedSourcePool({ maxCount: 1, telemetry: sinkB });

      // When
      for (let i = 0; i < 3; i++) {
        const token = {};
        await poolA.acquire(token, makeHydrator(`a${i}`));
        poolA.release(token);
        await poolB.acquire(token, makeHydrator(`b${i}`));
        poolB.release(token);
        await flushMicrotasks();
        sinkA.publishNow();
        sinkB.publishNow();
      }
      const poolIdsOf = (sink: BufferedTelemetrySink) =>
        new Set(
          [...poolSamples(sink.drain().records).values()]
            .flat()
            .map((record) => record.labels?.poolId),
        );
      const idsA = poolIdsOf(sinkA);
      const idsB = poolIdsOf(sinkB);

      // Then
      expect(idsA.size).toBe(1);
      expect(idsB.size).toBe(1);
      const [idA] = idsA;
      const [idB] = idsB;
      expect(idA).toMatch(/^pool-\d+$/);
      expect(idB).toMatch(/^pool-\d+$/);
      expect(idA).not.toBe(idB);
    });

    it("should not consume a default poolId ordinal for pools created while telemetry is disabled", async () => {
      // Given
      const sinkA = makeSink();
      const sinkB = makeSink();
      const poolA = new HydratedSourcePool({ maxCount: 1, telemetry: sinkA });
      // Default no-op realm sink: telemetry disabled.
      const disabledPools = Array.from(
        { length: 5 },
        () => new HydratedSourcePool({ maxCount: 1 }),
      );
      const poolB = new HydratedSourcePool({ maxCount: 1, telemetry: sinkB });

      // When
      for (const pool of disabledPools) {
        await pool.acquire({}, makeHydrator("disabled"));
      }
      await poolA.acquire({}, makeHydrator("A"));
      await poolB.acquire({}, makeHydrator("B"));
      const ordinalOf = (sink: BufferedTelemetrySink) =>
        Number(
          poolSamples(sink.drain().records)
            .get("acquires")
            ?.at(-1)
            ?.labels?.poolId?.slice("pool-".length),
        );

      // Then
      expect(ordinalOf(sinkB)).toBe(ordinalOf(sinkA) + 1);
    });

    it("should keep a fixed set of label-bounded series per pool regardless of token count", async () => {
      // Given
      const sink = makeSink();
      const pool = new HydratedSourcePool({ maxCount: 3, telemetry: sink, poolId: "multi" });
      const tokenCount = 100;

      // When
      for (let i = 0; i < tokenCount; i++) {
        const token = {};
        await pool.acquire(token, makeHydrator(`v${i}`, i));
        pool.release(token);
        await flushMicrotasks();
      }
      await pool.terminate();
      sink.publishNow();
      const records = sink.drain().records;

      // Then: 8 gauges + 11 counters, all labelled only with the pool id
      const samples = poolSamples(records);
      expect(samples.size).toBe(19);
      for (const series of samples.values()) {
        for (const record of series) {
          expect(record.labels).toEqual({ poolId: "multi" });
        }
      }
      const seriesCount = records.find(
        (record): record is TelemetrySample =>
          record.kind === "sample" && record.metric === "telemetry.seriesCount",
      );
      // the pool's 19 series + the seriesCount gauge itself
      expect(seriesCount?.value).toBe(20);
      expect(
        records.some(
          (record) => record.kind === "sample" && record.metric === "telemetry.rejectedRecords",
        ),
      ).toBe(false);
    });

    it("publishes gauges and counters with the poolId label to an injected sink", async () => {
      // Given
      const sink = makeSink();
      const pool = new HydratedSourcePool({ maxCount: 1, telemetry: sink, poolId: "multi" });
      const tokenA = {};
      const tokenB = {};

      // When
      await pool.acquire(tokenA, makeHydrator("A", 7));
      pool.release(tokenA);
      await pool.acquire(tokenB, makeHydrator("B", 9));
      sink.publishNow();
      const samples = poolSamples(sink.drain().records);

      // Then
      const gauge = (name: string) => samples.get(name)?.at(-1);
      const counter = (name: string) => samples.get(name)?.at(-1);
      expect(gauge("residentCount")).toMatchObject({
        metricType: "gauge",
        value: 1,
        unit: "count",
        scope: "pipeline",
        labels: { poolId: "multi" },
      });
      expect(gauge("residentBytes")).toMatchObject({ value: 9, unit: "bytes" });
      expect(gauge("activePins")).toMatchObject({ value: 1 });
      expect(gauge("pinnedEntries")).toMatchObject({ value: 1 });
      expect(gauge("overBudget")).toMatchObject({ value: 0 });
      expect(gauge("highWaterResidentCount")).toMatchObject({ value: 2 });
      expect(gauge("highWaterResidentBytes")).toMatchObject({ value: 9, unit: "bytes" });
      expect(gauge("highWaterActivePins")).toMatchObject({ value: 1 });
      expect(counter("acquires")).toMatchObject({ metricType: "counter", value: 2 });
      expect(counter("releases")).toMatchObject({ value: 1 });
      expect(counter("opens")).toMatchObject({ value: 2 });
      expect(counter("evictions")).toMatchObject({ value: 1 });
      expect(counter("closes")).toMatchObject({ value: 1 });
      // First publish registers every counter series, so zeros are explicit.
      expect(counter("failures")).toMatchObject({ value: 0 });
      expect(counter("rehydrations")).toMatchObject({ value: 0 });
      expect(counter("terminatedPins")).toMatchObject({ value: 0 });
      expect(counter("admits")).toMatchObject({ value: 0 });
      expect(counter("overBudgetPeriods")).toMatchObject({ value: 0 });
      expect(counter("overBudgetDurationMs")).toMatchObject({ value: 0, unit: "ms" });
    });

    it("should publish each removal while an earlier victim's close is still pending", async () => {
      // Given: two unpinned entries, the first with a close that stays pending until resolved
      const sink = makeSink();
      const pool = new HydratedSourcePool({ maxBytes: 100, telemetry: sink, poolId: "multi" });
      const slowClose = deferred<void>();
      const slowHydrator = makeHydrator("A", 10);
      slowHydrator.close.mockReturnValue(slowClose.promise);
      await pool.admit({}, slowHydrator, "A");
      await pool.admit({}, makeHydrator("B", 10), "B");
      sink.publishNow();
      sink.drain();

      // When: a heavy hydration needs two evictions and the first close is still pending
      const acquired = pool.acquire({}, makeHydrator("C", 200));
      await flushMicrotasks();
      sink.publishNow();
      const duringClose = poolSamples(sink.drain().records);
      slowClose.resolve();
      await acquired;
      sink.publishNow();
      const afterPass = poolSamples(sink.drain().records);

      // Then
      expect(slowHydrator.close).toHaveBeenCalledTimes(1);
      expect(duringClose.get("residentBytes")?.at(-1)).toMatchObject({ value: 210 });
      expect(duringClose.get("residentCount")?.at(-1)).toMatchObject({ value: 2 });
      expect(duringClose.get("evictions")?.at(-1)).toMatchObject({ value: 1 });
      expect(afterPass.get("residentBytes")?.at(-1)).toMatchObject({ value: 200 });
      expect(afterPass.get("evictions")?.at(-1)).toMatchObject({ value: 2 });
      expect(afterPass.get("closes")?.at(-1)).toMatchObject({ value: 2 });
    });

    it("publishes over-budget duration increments while the period is open", async () => {
      // Given
      const sink = makeSink();
      const clock = makeClock();
      const pool = new HydratedSourcePool({ maxCount: 1, telemetry: sink, now: clock.now });
      const tokenA = {};
      const tokenB = {};
      await pool.acquire(tokenA, makeHydrator("A"));
      await pool.acquire(tokenB, makeHydrator("B"));

      // When
      clock.advance(300);
      pool.release(tokenA);
      await flushMicrotasks();
      sink.publishNow();
      const samples = poolSamples(sink.drain().records);

      // Then
      expect(samples.get("overBudgetPeriods")?.at(-1)).toMatchObject({ value: 1 });
      expect(samples.get("overBudgetDurationMs")?.at(-1)).toMatchObject({ value: 300 });
      expect(samples.get("overBudget")?.at(-1)).toMatchObject({ value: 0 });
    });

    it("assigns a default pool-<n> poolId and uses the realm sink by default", async () => {
      // Given
      const sink = makeSink();
      setTelemetrySink(sink);

      // When
      const pool = new HydratedSourcePool({ maxCount: 1 });
      await pool.acquire({}, makeHydrator("A"));
      sink.publishNow();
      const samples = poolSamples(sink.drain().records);

      // Then
      expect(samples.get("acquires")?.at(-1)?.labels?.poolId).toMatch(/^pool-\d+$/);
    });

    it("emits nothing and does not fail with a disabled sink", async () => {
      // Given
      const telemetry = TelemetryBuilder.mockTelemetry({ enabled: false });
      const options: HydratedSourcePoolOptions = { maxCount: 1, telemetry };
      const pool = new HydratedSourcePool(options);
      const token = {};

      // When
      await pool.acquire(token, makeHydrator("A"));
      pool.release(token);
      await pool.acquire({}, makeHydrator("B"));
      await pool.terminate();

      // Then
      expect(telemetry.gauge).not.toHaveBeenCalled();
      expect(telemetry.counter).not.toHaveBeenCalled();
      expectInvariant(pool.getStats());
    });

    it("works with the default no-op sink", async () => {
      // Given
      const pool = new HydratedSourcePool({ maxCount: 1 });
      const token = {};

      // When
      await pool.acquire(token, makeHydrator("A"));
      pool.release(token);
      await pool.terminate();

      // Then
      expect(pool.getStats()).toMatchObject({ acquires: 1, releases: 1, closes: 1 });
    });
  });
});
