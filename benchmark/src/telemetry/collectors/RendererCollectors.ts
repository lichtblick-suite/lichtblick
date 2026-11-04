// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry, TelemetryEvent } from "@lichtblick/suite-base/util/telemetry";

import { FrameCollector } from "./FrameCollector";
import { JsHeapCollector } from "./JsHeapCollector";
import { LongTaskCollector } from "./LongTaskCollector";
import { SelfCostCounter, SelfCostMeter } from "./SelfCostMeter";
import { UaSpecificMemoryCollector } from "./UaSpecificMemoryCollector";
import { COLLECTOR_TICK_INTERVAL_MS } from "./constants";
import {
  CollectorPerformance,
  LongTaskObserverConstructor,
  RendererCollectorsEnv,
  RendererCollectorsOptions,
  UaMemoryCollectorState,
} from "./types";

/** Builds the collector environment from the current (window) realm. */
export function getDefaultRendererCollectorsEnv(): RendererCollectorsEnv {
  const realm = globalThis as typeof globalThis & {
    PerformanceObserver?: LongTaskObserverConstructor;
  };
  const performance = realm.performance as Performance & CollectorPerformance;
  return {
    now: () => performance.now(),
    setInterval: (handler, intervalMs) => realm.setInterval(handler, intervalMs),
    clearInterval: (handle) => {
      realm.clearInterval(handle as ReturnType<typeof setInterval>);
    },
    requestAnimationFrame:
      typeof realm.requestAnimationFrame === "function"
        ? (callback) => realm.requestAnimationFrame(callback)
        : undefined,
    cancelAnimationFrame:
      typeof realm.cancelAnimationFrame === "function"
        ? (handle) => {
            realm.cancelAnimationFrame(handle);
          }
        : undefined,
    performance,
    PerformanceObserver: realm.PerformanceObserver,
    crossOriginIsolated: realm.crossOriginIsolated,
  };
}

/**
 * Owns all renderer-side collectors and their 1 Hz tick (a plain interval, never driven from the
 * RAF loop). Event-driven collection is fed through `handleEvent`, which the installer wires to the
 * sink's `onEvent` (own and ingested events):
 * - `datasource.firstMessage` arms `frame.firstUseful` for the next animation frame
 * - `datasource.open`/`datasource.close` end events trigger a UA-specific memory measurement
 *   (unless the UA-memory collector is disabled with `uaMemoryEnabled: false`)
 *
 * The tick also times itself (`telemetry.self.timeMs.collectors`: heap sample + fps publish + UA
 * scheduling) and then publishes all self-cost counters of the shared `SelfCostMeter`.
 */
export class RendererCollectors {
  readonly #telemetry: ITelemetry;
  readonly #env: RendererCollectorsEnv;
  readonly #heap: JsHeapCollector;
  readonly #longTasks: LongTaskCollector;
  readonly #frames: FrameCollector;
  /** Undefined when disabled with `?telemetry.uaMemory=off`: then it is never called. */
  readonly #uaMemory: UaSpecificMemoryCollector | undefined;
  readonly #selfCost: SelfCostMeter;
  readonly #selfTime: SelfCostCounter;
  #timerHandle: unknown;
  #state: "idle" | "running" | "paused" | "disposed" = "idle";

  readonly #tick = (): void => {
    const selfStartMs = this.#selfTime.now();
    this.#heap.sample();
    this.#frames.publish();
    this.#uaMemory?.maybeMeasurePeriodic();
    this.#selfTime.addSince(selfStartMs);
    this.#selfCost.publish(this.#telemetry);
  };

  public constructor(
    telemetry: ITelemetry,
    env: RendererCollectorsEnv,
    options: RendererCollectorsOptions = {},
  ) {
    this.#telemetry = telemetry;
    this.#env = env;
    this.#selfCost = options.selfCost ?? new SelfCostMeter(env.now);
    this.#selfTime = this.#selfCost.counter("collectorsMs");
    this.#heap = new JsHeapCollector(telemetry, env.performance);
    this.#longTasks = new LongTaskCollector(telemetry, env.PerformanceObserver, this.#selfCost);
    this.#frames = new FrameCollector(telemetry, env, options.lateFrameThresholdMs, this.#selfCost);
    this.#uaMemory =
      options.uaMemoryEnabled === false
        ? undefined
        : new UaSpecificMemoryCollector(telemetry, env, this.#selfCost);
  }

  /** `off` when disabled by option, `unsupported` without cross-origin isolation / API, else `on`. */
  public uaMemoryState(): UaMemoryCollectorState {
    if (this.#uaMemory == undefined) {
      return "off";
    }
    return this.#uaMemory.isSupported() ? "on" : "unsupported";
  }

  /** `measureUserAgentSpecificMemory()` calls so far (cumulative); 0 when the collector is off. */
  public uaMemoryCalls(): number {
    return this.#uaMemory?.callCount() ?? 0;
  }

  /** Starts all collectors. Only the first call has an effect; never restarts after dispose. */
  public start(): void {
    if (this.#state !== "idle") {
      return;
    }
    this.#state = "running";
    this.#heap.sample();
    this.#longTasks.start();
    this.#frames.start();
    this.#uaMemory?.measure();
    this.#timerHandle = this.#env.setInterval(this.#tick, COLLECTOR_TICK_INTERVAL_MS);
  }

  public handleEvent(event: TelemetryEvent): void {
    if (this.#state !== "running") {
      return;
    }
    switch (event.name) {
      case "datasource.firstMessage":
        this.#frames.markFirstMessage(event.labels);
        break;
      case "datasource.open":
      case "datasource.close":
        if (event.phase === "end") {
          this.#uaMemory?.measure();
        }
        break;
      default:
        break;
    }
  }

  /**
   * Pauses collection (telemetry toggled off): publishes the current partial window (heap, fps,
   * self cost) like `dispose()`, then stops the tick, the frame recording, the long-task observer
   * and the UA-memory collector. The frame collector's RAF loop keeps running (harness, see
   * `FrameCollector.pause`). No-op unless running.
   */
  public pause(): void {
    if (this.#state !== "running") {
      return;
    }
    this.#publishFinalWindow();
    this.#state = "paused";
    this.#stopAll();
    this.#uaMemory?.pause();
  }

  /**
   * Resumes after `pause()`: new fps window, long-task observer without the buffered entries of the
   * paused period, tick restarted. Takes no immediate heap sample and requests no UA-memory
   * measurement (its periodic spacing is kept across the pause). No-op unless paused.
   */
  public resume(): void {
    if (this.#state !== "paused") {
      return;
    }
    this.#state = "running";
    this.#longTasks.start({ buffered: false });
    this.#frames.start();
    this.#uaMemory?.resume();
    this.#timerHandle = this.#env.setInterval(this.#tick, COLLECTOR_TICK_INTERVAL_MS);
  }

  /**
   * Records a final sample of the current window and publishes the pending self-cost counters,
   * then stops timers, frame recording and RAF loop, and observer. When paused, the final window was already published.
   */
  public dispose(): void {
    if (this.#state === "running") {
      // Final partial window; no UA-memory measurement at teardown.
      this.#publishFinalWindow();
      this.#stopAll();
    }
    this.#state = "disposed";
    this.#frames.dispose();
    this.#longTasks.dispose();
    this.#uaMemory?.dispose();
  }

  #publishFinalWindow(): void {
    this.#heap.sample();
    this.#frames.publish();
    this.#selfCost.publish(this.#telemetry);
  }

  #stopAll(): void {
    this.#env.clearInterval(this.#timerHandle);
    this.#timerHandle = undefined;
    this.#frames.pause();
    this.#longTasks.dispose();
  }
}
