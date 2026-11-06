// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  getTelemetry,
  setTelemetrySink,
  TelemetryEvent,
  TelemetryRecord,
} from "@lichtblick/suite-base/util/telemetry";

import {
  buildSteppingClock,
  FakeAnimationFrames,
  RendererCollectorsEnvBuilder,
} from "./collectors/builders/RendererCollectorsEnvBuilder";
import { TELEMETRY_SELF_COST_METRICS } from "./constants";
import { installBenchmarkTelemetry, parseLateFrameThresholdMs } from "./installBenchmarkTelemetry";
import { TelemetryInstallTarget } from "./types";

type Listener = () => void;

class FakeTarget implements TelemetryInstallTarget {
  public lichtblickTelemetry: TelemetryInstallTarget["lichtblickTelemetry"];
  public readonly listeners = new Map<string, Set<Listener>>();

  public addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  public removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  public dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener();
    }
  }

  public listenerCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }
}

const URL_ON = new URL("http://localhost/?scenario=sinewave");
const URL_OFF = new URL("http://localhost/?scenario=sinewave&telemetry=off");

function events(target: FakeTarget): TelemetryEvent[] {
  return target
    .lichtblickTelemetry!.drain()
    .records.filter((record): record is TelemetryEvent => record.kind === "event");
}

describe("installBenchmarkTelemetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    setTelemetrySink(undefined);
    jest.useRealTimers();
  });

  describe("when telemetry=off", () => {
    it("should expose a disabled window API and record nothing", () => {
      // Given
      const target = new FakeTarget();
      const frames = new FakeAnimationFrames();
      const { env } = new RendererCollectorsEnvBuilder().withFrames(frames).build();

      // When
      const handle = installBenchmarkTelemetry(URL_OFF, { target, collectorsEnv: env });

      // Then
      expect(handle).toBeUndefined();
      expect(getTelemetry().isEnabled()).toBe(false);
      expect(target.lichtblickTelemetry?.isEnabled()).toBe(false);
      expect(target.lichtblickTelemetry?.drain()).toEqual({
        realm: "renderer",
        records: [],
        dropped: 0,
      });
      expect(typeof target.lichtblickTelemetry?.now()).toBe("number");
      expect(frames.requestAnimationFrame).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expect(target.listenerCount()).toBe(0);
    });
  });

  describe("when enabled", () => {
    it("should install the renderer sink as the realm sink and expose it on the window", () => {
      // Given
      const target = new FakeTarget();
      const { env } = new RendererCollectorsEnvBuilder().build();

      // When
      const handle = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env });
      getTelemetry().event("datasource.open", "start", "pipeline", { sourceId: "s" });

      // Then
      expect(handle).toBeDefined();
      expect(getTelemetry().isEnabled()).toBe(true);
      expect(target.lichtblickTelemetry?.isEnabled()).toBe(true);
      const batch = target.lichtblickTelemetry!.drain();
      expect(batch.realm).toBe("renderer");
      expect(batch.records).toEqual([
        expect.objectContaining({ kind: "event", name: "datasource.open", realm: "renderer" }),
      ]);
      handle?.dispose();
    });

    it("should publish collector metrics through the sink at 1 Hz", () => {
      // Given
      const target = new FakeTarget();
      const frames = new FakeAnimationFrames();
      const { env, clock } = new RendererCollectorsEnvBuilder()
        .withMemory({ usedJSHeapSize: 5, totalJSHeapSize: 6, jsHeapSizeLimit: 7 })
        .withFrames(frames)
        .build();
      const handle = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env });

      // When
      frames.fireFrame(16);
      frames.fireFrame(32);
      // The sink publishes on its own 1 Hz timer, so collector samples from the tick at t=1s
      // become drainable with the following publish.
      clock.now = 2000;
      jest.advanceTimersByTime(2000);

      // Then
      const metrics = target
        .lichtblickTelemetry!.drain()
        .records.flatMap((record) => (record.kind === "sample" ? [record.metric] : []));
      expect(metrics).toEqual(
        expect.arrayContaining([
          "renderer.jsHeap.usedBytes",
          "renderer.jsHeap.totalBytes",
          "renderer.jsHeap.limitBytes",
          "renderer.fps",
          "renderer.frames",
          "renderer.lateFrames",
        ]),
      );
      handle?.dispose();
    });

    it("should count late frames against the ?telemetry.lateFrameThresholdMs override", () => {
      // Given: threshold 10 ms; one 16 ms delta
      const target = new FakeTarget();
      const frames = new FakeAnimationFrames();
      const { env, clock } = new RendererCollectorsEnvBuilder().withFrames(frames).build();
      const url = new URL("http://localhost/?scenario=sinewave&telemetry.lateFrameThresholdMs=10");
      const handle = installBenchmarkTelemetry(url, { target, collectorsEnv: env });

      // When
      frames.fireFrame(16);
      frames.fireFrame(32);
      clock.now = 2000;
      jest.advanceTimersByTime(2000);

      // Then
      const lateFrames = target
        .lichtblickTelemetry!.drain()
        .records.flatMap((record) =>
          record.kind === "sample" && record.metric === "renderer.lateFrames" ? [record.value] : [],
        );
      expect(Math.max(...lateFrames)).toBe(1);
      handle?.dispose();
    });

    it("should emit app.ready only once", () => {
      // Given
      const target = new FakeTarget();
      const { env } = new RendererCollectorsEnvBuilder().build();
      const handle = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env })!;

      // When
      handle.markAppReady();
      handle.markAppReady();

      // Then
      expect(events(target)).toEqual([
        expect.objectContaining({ name: "app.ready", phase: "instant", scope: "app" }),
      ]);
      handle.dispose();
    });

    it("should route datasource.firstMessage to frame.firstUseful on the next frame", () => {
      // Given
      const target = new FakeTarget();
      const frames = new FakeAnimationFrames();
      const { env } = new RendererCollectorsEnvBuilder().withFrames(frames).build();
      const handle = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env })!;

      // When
      getTelemetry().event("datasource.firstMessage", "instant", "pipeline", { sourceId: "s" });
      frames.fireFrame(16);

      // Then
      expect(events(target).map((event) => event.name)).toEqual([
        "datasource.firstMessage",
        "frame.firstUseful",
      ]);
      handle.dispose();
    });

    it("should stop everything on pagehide while keeping records drainable", () => {
      // Given
      const target = new FakeTarget();
      const frames = new FakeAnimationFrames();
      const { env } = new RendererCollectorsEnvBuilder().withFrames(frames).build();
      installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env })!.markAppReady();

      // When
      target.dispatch("pagehide");

      // Then
      expect(target.lichtblickTelemetry?.isEnabled()).toBe(false);
      expect(getTelemetry().isEnabled()).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      expect(frames.hasPending()).toBe(false);
      expect(target.listenerCount()).toBe(0);
      expect(events(target).map((event) => event.name)).toEqual(["app.ready"]);
    });

    it("should stop everything once on beforeunload and ignore a later pagehide", () => {
      // Given
      const target = new FakeTarget();
      const frames = new FakeAnimationFrames();
      const { env } = new RendererCollectorsEnvBuilder().withFrames(frames).build();
      const handle = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env })!;
      handle.markAppReady();

      // When
      target.dispatch("beforeunload");
      const afterUnload = target.lichtblickTelemetry!.drain();
      target.dispatch("pagehide");
      handle.dispose();
      handle.markAppReady();

      // Then
      expect(getTelemetry().isEnabled()).toBe(false);
      expect(jest.getTimerCount()).toBe(0);
      expect(frames.hasPending()).toBe(false);
      expect(target.listenerCount()).toBe(0);
      expect(afterUnload.records.filter((record) => record.kind === "event")).toHaveLength(1);
      expect(target.lichtblickTelemetry!.drain()).toEqual({
        realm: "renderer",
        records: [],
        dropped: 0,
      });
    });

    it("should keep the first installation when called twice", () => {
      // Given
      const target = new FakeTarget();
      const { env } = new RendererCollectorsEnvBuilder().build();
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
      const first = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env });
      const api = target.lichtblickTelemetry;

      // When
      const second = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env });

      // Then
      expect(second).toBe(first);
      expect(target.lichtblickTelemetry).toBe(api);
      expect(warn).toHaveBeenCalledTimes(1);
      first?.dispose();
    });
  });

  describe("self cost", () => {
    function selfCostValue(records: TelemetryRecord[], metric: string): number | undefined {
      let value: number | undefined;
      for (const record of records) {
        if (record.kind === "sample" && record.metric === metric) {
          value = record.value;
        }
      }
      return value;
    }

    it("should publish the time spent in the sink publish tick and in drain()", () => {
      // Given: every collectors-clock read advances 1 ms
      const target = new FakeTarget();
      const { env } = new RendererCollectorsEnvBuilder()
        .withFrames(undefined)
        .withNow(buildSteppingClock(1))
        .build();
      const handle = installBenchmarkTelemetry(URL_ON, { target, collectorsEnv: env });
      const api = target.lichtblickTelemetry!;

      // When: sink publish at 1 s (timed), collector tick publishes self cost, sink publishes it
      // at 2 s; the drain in between is timed and published the same way by 4 s
      jest.advanceTimersByTime(2000);
      const first = api.drain().records;
      jest.advanceTimersByTime(2000);
      const second = api.drain().records;

      // Then
      expect(
        selfCostValue(first, TELEMETRY_SELF_COST_METRICS.sinkPublishMs),
      ).toBeGreaterThanOrEqual(1);
      expect(selfCostValue(first, TELEMETRY_SELF_COST_METRICS.collectorsMs)).toBeGreaterThanOrEqual(
        1,
      );
      expect(selfCostValue(second, TELEMETRY_SELF_COST_METRICS.drainMs)).toBe(1);
      const selfSample = first.find(
        (record) =>
          record.kind === "sample" && record.metric === TELEMETRY_SELF_COST_METRICS.sinkPublishMs,
      );
      expect(selfSample).toMatchObject({ metricType: "counter", unit: "ms", scope: "renderer" });
      expect(selfSample).not.toHaveProperty("labels");
      handle?.dispose();
    });
  });
});

describe("parseLateFrameThresholdMs", () => {
  it.each([
    ["12.5", 12.5],
    ["25", 25],
  ])("should parse the positive override %s", (raw, expected) => {
    // Given
    const url = new URL(`http://localhost/?telemetry.lateFrameThresholdMs=${raw}`);

    // When
    const threshold = parseLateFrameThresholdMs(url);

    // Then
    expect(threshold).toBe(expected);
  });

  it.each([
    "",
    "0",
    "-5",
    "abc",
    "Infinity",
  ])("should fall back to the default for the invalid override %p", (raw) => {
    // Given
    const url = new URL(`http://localhost/?telemetry.lateFrameThresholdMs=${raw}`);

    // When
    const threshold = parseLateFrameThresholdMs(url);

    // Then
    expect(threshold).toBeUndefined();
  });

  it("should return undefined without the param", () => {
    // Given / When / Then
    expect(parseLateFrameThresholdMs(URL_ON)).toBeUndefined();
  });
});
