// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ComlinkWrap } from "@lichtblick/den/worker";
import {
  BufferedTelemetrySink,
  setTelemetrySink,
  type TelemetryBatch,
} from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";

import { WorkerSerializedIterableSource } from "./WorkerSerializedIterableSource";
import { TELEMETRY_FINAL_DRAIN_TIMEOUT_MS } from "./constants";

jest.mock("@lichtblick/den/worker", () => ({
  ComlinkWrap: jest.fn(),
}));

const mockComlinkWrap = ComlinkWrap as jest.MockedFunction<typeof ComlinkWrap>;

function makeMockRemote(
  overrides: {
    terminate?: jest.Mock;
    drainTelemetry?: jest.Mock;
    enableTelemetry?: jest.Mock;
  } = {},
) {
  return {
    initialize: jest.fn().mockResolvedValue({ topics: [] }),
    terminate: overrides.terminate ?? jest.fn().mockResolvedValue(undefined),
    enableTelemetry: overrides.enableTelemetry ?? jest.fn().mockResolvedValue(undefined),
    drainTelemetry: overrides.drainTelemetry ?? jest.fn().mockResolvedValue(undefined),
  };
}

function mockWorker(remote: ReturnType<typeof makeMockRemote>, dispose: jest.Mock = jest.fn()) {
  mockComlinkWrap.mockReturnValueOnce({
    remote: jest.fn().mockResolvedValue(remote) as any,
    dispose,
  });
  return dispose;
}

function makeSource(): WorkerSerializedIterableSource {
  return new WorkerSerializedIterableSource({
    initWorker: () => ({}) as unknown as Worker,
    initArgs: {},
  });
}

describe("WorkerSerializedIterableSource", () => {
  beforeEach(() => {
    mockComlinkWrap.mockReset();
  });

  it("still disposes the worker when the remote's terminate() rejects", async () => {
    // GIVEN: an initialized source whose worker-side terminate() rejects.
    const dispose = jest.fn();
    const remote = makeMockRemote({ terminate: jest.fn().mockRejectedValue(new Error("boom")) });
    mockComlinkWrap.mockReturnValueOnce({
      remote: jest.fn().mockResolvedValue(remote) as any,
      dispose,
    });
    const source = makeSource();
    await source.initialize();

    // WHEN/THEN: terminate() rejects with the same error...
    await expect(source.terminate()).rejects.toThrow("boom");

    // ...but the worker is still disposed.
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("does not let a concurrent initialize() worker get disposed or cleared by an in-flight terminate()", async () => {
    // GIVEN: a first initialized worker whose terminate() call is left pending.
    const dispose1 = jest.fn();
    let resolveTerminate1: () => void = () => {};
    const terminate1Promise = new Promise<void>((resolve) => {
      resolveTerminate1 = resolve;
    });
    const remote1 = makeMockRemote({ terminate: jest.fn().mockReturnValue(terminate1Promise) });
    mockComlinkWrap.mockReturnValueOnce({
      remote: jest.fn().mockResolvedValue(remote1) as any,
      dispose: dispose1,
    });
    const source = makeSource();
    await source.initialize();

    // WHEN: terminate() is started but not yet resolved...
    const firstTerminate = source.terminate();

    // ...and, before it resolves, initialize() is called again, producing a second worker.
    const dispose2 = jest.fn();
    const remote2 = makeMockRemote();
    mockComlinkWrap.mockReturnValueOnce({
      remote: jest.fn().mockResolvedValue(remote2) as any,
      dispose: dispose2,
    });
    await source.initialize();

    // Let the first terminate()'s remote.terminate() resolve.
    resolveTerminate1();
    await firstTerminate;

    // THEN: only the worker captured by the first terminate() call was disposed; the second
    // (newer) worker from the concurrent initialize() was left untouched.
    expect(dispose1).toHaveBeenCalledTimes(1);
    expect(dispose2).not.toHaveBeenCalled();

    // AND: the source still targets the second (newer) worker — a subsequent terminate() operates
    // on it, proving it wasn't cleared by the earlier in-flight terminate().
    await source.terminate();
    expect(remote2.terminate).toHaveBeenCalledTimes(1);
    expect(dispose2).toHaveBeenCalledTimes(1);
  });

  describe("worker telemetry bridge", () => {
    let mainSink: BufferedTelemetrySink;

    beforeEach(() => {
      jest.useFakeTimers();
      mainSink = new BufferedTelemetrySink({
        realm: "renderer",
        setInterval: jest.fn(),
        clearInterval: jest.fn(),
      });
    });

    afterEach(() => {
      setTelemetrySink(undefined);
      jest.useRealTimers();
    });

    it("is not started when main-thread telemetry is disabled", async () => {
      // Given: the default no-op sink.
      const remote = makeMockRemote();
      mockWorker(remote);
      const source = makeSource();

      // When
      await source.initialize();
      await jest.advanceTimersByTimeAsync(5000);
      await source.terminate();

      // Then
      expect(remote.enableTelemetry).not.toHaveBeenCalled();
      expect(remote.drainTelemetry).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it("enables the worker realm before initialize() and ingests drained batches at 1 Hz", async () => {
      // Given
      setTelemetrySink(mainSink);
      const batch: TelemetryBatch = TelemetryBuilder.batch({ realm: "worker:x" });
      const remote = makeMockRemote({ drainTelemetry: jest.fn().mockResolvedValue(batch) });
      mockWorker(remote);
      const source = makeSource();

      // When
      await source.initialize();
      await jest.advanceTimersByTimeAsync(999);
      const drainsBeforeTick = remote.drainTelemetry.mock.calls.length;
      await jest.advanceTimersByTimeAsync(1);

      // Then
      expect(remote.enableTelemetry).toHaveBeenCalledWith(expect.stringMatching(/^worker:\d+$/));
      expect(remote.enableTelemetry.mock.invocationCallOrder[0]).toBeLessThan(
        remote.initialize.mock.invocationCallOrder[0]!,
      );
      expect(drainsBeforeTick).toBe(0);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(mainSink.drain().records).toEqual(batch.records);

      await source.terminate();
    });

    it("does not start overlapping drains", async () => {
      // Given: a drain that never resolves on its own.
      setTelemetrySink(mainSink);
      let resolveDrain: (value: TelemetryBatch | undefined) => void = () => {};
      const drainTelemetry = jest.fn().mockReturnValueOnce(
        new Promise<TelemetryBatch | undefined>((resolve) => {
          resolveDrain = resolve;
        }),
      );
      const remote = makeMockRemote({ drainTelemetry });
      mockWorker(remote);
      const source = makeSource();
      await source.initialize();

      // When
      await jest.advanceTimersByTimeAsync(3000);

      // Then
      expect(drainTelemetry).toHaveBeenCalledTimes(1);

      resolveDrain(undefined);
      await source.terminate();
    });

    it("drains a final time after the worker terminated and before it is disposed, then stops the timer", async () => {
      // Given
      setTelemetrySink(mainSink);
      const finalBatch = TelemetryBuilder.batch({ realm: "worker:final" });
      const remote = makeMockRemote({ drainTelemetry: jest.fn().mockResolvedValue(finalBatch) });
      const dispose = mockWorker(remote);
      const source = makeSource();
      await source.initialize();

      // When
      await source.terminate();
      await jest.advanceTimersByTimeAsync(5000);

      // Then
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      const drainOrder = remote.drainTelemetry.mock.invocationCallOrder[0]!;
      expect(remote.terminate.mock.invocationCallOrder[0]).toBeLessThan(drainOrder);
      expect(drainOrder).toBeLessThan(dispose.mock.invocationCallOrder[0]!);
      expect(mainSink.drain().records).toEqual(finalBatch.records);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("still disposes the worker when the final drain fails", async () => {
      // Given
      setTelemetrySink(mainSink);
      const remote = makeMockRemote({
        drainTelemetry: jest.fn().mockRejectedValue(new Error("worker gone")),
      });
      const dispose = mockWorker(remote);
      const source = makeSource();
      await source.initialize();

      // When
      await source.terminate();

      // Then
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("stops pulling from the previous worker when initialize() is called again", async () => {
      // Given
      setTelemetrySink(mainSink);
      const remote1 = makeMockRemote();
      const dispose1 = mockWorker(remote1);
      const source = makeSource();
      await source.initialize();

      // When
      const remote2 = makeMockRemote();
      mockWorker(remote2);
      await source.initialize();
      await jest.advanceTimersByTimeAsync(1000);

      // Then
      expect(dispose1).toHaveBeenCalledTimes(1);
      expect(remote1.drainTelemetry).not.toHaveBeenCalled();
      expect(remote2.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(1);

      await source.terminate();
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should assign a distinct worker:<n> realm to every worker instance, including re-initialization", async () => {
      // Given
      setTelemetrySink(mainSink);
      const remotes = [makeMockRemote(), makeMockRemote(), makeMockRemote()];
      for (const remote of remotes) {
        mockWorker(remote);
      }
      const sourceA = makeSource();
      const sourceB = makeSource();

      // When
      await sourceA.initialize();
      await sourceB.initialize();
      await sourceA.initialize();
      await sourceA.terminate();
      await sourceB.terminate();

      // Then
      const realms = remotes.map((remote) => String(remote.enableTelemetry.mock.calls[0]?.[0]));
      for (const realm of realms) {
        expect(realm).toMatch(/^worker:\d+$/);
      }
      expect(new Set(realms).size).toBe(remotes.length);
      const ordinals = realms.map((realm) => Number(realm.slice("worker:".length)));
      expect(ordinals).toEqual([ordinals[0], ordinals[0]! + 1, ordinals[0]! + 2]);
    });

    it("should clear the bridge interval on terminate after initialize() rejected", async () => {
      // Given
      setTelemetrySink(mainSink);
      const remote = makeMockRemote();
      remote.initialize.mockRejectedValue(new Error("bad file"));
      const dispose = mockWorker(remote);
      const source = makeSource();
      await expect(source.initialize()).rejects.toThrow("bad file");

      // When
      await source.terminate();
      await jest.advanceTimersByTimeAsync(5000);

      // Then
      expect(jest.getTimerCount()).toBe(0);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("should still initialize and clean up when enabling worker telemetry fails", async () => {
      // Given
      setTelemetrySink(mainSink);
      const remote = makeMockRemote({
        enableTelemetry: jest.fn().mockRejectedValue(new Error("no telemetry")),
      });
      mockWorker(remote);
      const source = makeSource();

      // When
      const initialization = await source.initialize();
      await source.terminate();

      // Then
      expect(initialization).toEqual({ topics: [] });
      expect(remote.initialize).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("enable failure stops the timer", async () => {
      // Given
      setTelemetrySink(mainSink);
      const remote = makeMockRemote({
        enableTelemetry: jest.fn().mockRejectedValue(new Error("no telemetry")),
      });
      const dispose = mockWorker(remote);
      const source = makeSource();

      // When
      await source.initialize();
      const timersAfterInitialize = jest.getTimerCount();
      await jest.advanceTimersByTimeAsync(5000);
      await source.terminate();

      // Then: no periodic drain ran, only terminate()'s final drain, and the worker is disposed.
      expect(timersAfterInitialize).toBe(0);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it("should still dispose the worker when a periodic drain in flight never settles", async () => {
      // Given: a periodic drain that never settles (dead worker)
      setTelemetrySink(mainSink);
      const remote = makeMockRemote({
        drainTelemetry: jest.fn().mockReturnValue(new Promise<never>(() => {})),
      });
      const dispose = mockWorker(remote);
      const source = makeSource();
      await source.initialize();
      await jest.advanceTimersByTimeAsync(1000);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);

      // When
      const terminating = source.terminate();
      await jest.advanceTimersByTimeAsync(TELEMETRY_FINAL_DRAIN_TIMEOUT_MS);
      await terminating;

      // Then: the worker is disposed, no final drain was started after the deadline and no timer
      // is left running.
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should still dispose the worker when the final drain never settles", async () => {
      // Given: a worker whose drain never settles (dead worker), and no periodic drain in flight
      setTelemetrySink(mainSink);
      const remote = makeMockRemote({
        drainTelemetry: jest.fn().mockReturnValue(new Promise<never>(() => {})),
      });
      const dispose = mockWorker(remote);
      const source = makeSource();
      await source.initialize();

      // When
      const terminating = source.terminate();
      await jest.advanceTimersByTimeAsync(TELEMETRY_FINAL_DRAIN_TIMEOUT_MS);
      await terminating;

      // Then
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should ingest an in-flight periodic batch before the final batch on terminate", async () => {
      // Given
      setTelemetrySink(mainSink);
      const realm = TelemetryBuilder.realm();
      const periodicBatch = TelemetryBuilder.batch({
        realm,
        records: [TelemetryBuilder.event({ realm, sequence: 0 })],
      });
      const finalBatch = TelemetryBuilder.batch({
        realm,
        records: [TelemetryBuilder.event({ realm, sequence: 1 })],
      });
      let resolvePeriodic: (batch: TelemetryBatch) => void = () => {};
      const drainTelemetry = jest
        .fn()
        .mockReturnValueOnce(
          new Promise<TelemetryBatch>((resolve) => {
            resolvePeriodic = resolve;
          }),
        )
        .mockResolvedValueOnce(finalBatch);
      const remote = makeMockRemote({ drainTelemetry });
      mockWorker(remote);
      const source = makeSource();
      await source.initialize();
      await jest.advanceTimersByTimeAsync(1000);

      // When
      const terminating = source.terminate();
      await jest.advanceTimersByTimeAsync(0);
      resolvePeriodic(periodicBatch);
      await terminating;

      // Then
      expect(drainTelemetry).toHaveBeenCalledTimes(2);
      expect(mainSink.drain().records.map((record) => record.sequence)).toEqual([0, 1]);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should not start the bridge when terminate() runs while the worker is being created", async () => {
      // Given: a worker whose initializeWorker() call is left pending.
      setTelemetrySink(mainSink);
      const remote = makeMockRemote();
      const dispose = jest.fn();
      let resolveInitializeWorker: (value: typeof remote) => void = () => {};
      mockComlinkWrap.mockReturnValueOnce({
        remote: jest.fn().mockReturnValue(
          new Promise<typeof remote>((resolve) => {
            resolveInitializeWorker = resolve;
          }),
        ) as any,
        dispose,
      });
      const source = makeSource();
      const initializing = source.initialize();

      // When: terminate() completes before initializeWorker() resolves.
      await source.terminate();
      resolveInitializeWorker(remote);
      await initializing;
      await jest.advanceTimersByTimeAsync(5000);

      // Then: the stale worker is not bridged nor published as the active remote; its initialize()
      // still runs once so the pending initialize() call settles.
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(remote.initialize).toHaveBeenCalledTimes(1);
      expect(remote.enableTelemetry).not.toHaveBeenCalled();
      expect(remote.drainTelemetry).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expect(() => source.getMessageCursor({ topics: new Map() })).toThrow("not initialized");
    });

    it("should stop the bridge timer when terminate() runs while enableTelemetry() is pending", async () => {
      // Given: a worker whose enableTelemetry() call is left pending.
      setTelemetrySink(mainSink);
      let resolveEnable: () => void = () => {};
      const remote = makeMockRemote({
        enableTelemetry: jest.fn().mockReturnValue(
          new Promise<void>((resolve) => {
            resolveEnable = resolve;
          }),
        ),
      });
      const dispose = mockWorker(remote);
      const source = makeSource();
      const initializing = source.initialize();
      await jest.advanceTimersByTimeAsync(0);
      expect(remote.enableTelemetry).toHaveBeenCalledTimes(1);

      // When: terminate() completes before enableTelemetry() resolves.
      await source.terminate();
      const drainsAfterTerminate = remote.drainTelemetry.mock.calls.length;
      resolveEnable();
      await initializing;
      await jest.advanceTimersByTimeAsync(5000);

      // Then: only terminate()'s final drain happened and no timer is left running.
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(drainsAfterTerminate).toBe(1);
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });

    it("should account worker drops reported in bridged batches on the main sink", async () => {
      // Given
      setTelemetrySink(mainSink);
      const realm = TelemetryBuilder.realm();
      const dropped = 7;
      const remote = makeMockRemote({
        drainTelemetry: jest
          .fn()
          .mockResolvedValue(TelemetryBuilder.batch({ realm, records: [], dropped })),
      });
      mockWorker(remote);
      const source = makeSource();
      await source.initialize();

      // When: two periodic drains + the final drain
      await jest.advanceTimersByTimeAsync(2000);
      await source.terminate();

      // Then
      expect(remote.drainTelemetry).toHaveBeenCalledTimes(3);
      expect(mainSink.drain().dropped).toBe(dropped * 3);
    });
  });
});
