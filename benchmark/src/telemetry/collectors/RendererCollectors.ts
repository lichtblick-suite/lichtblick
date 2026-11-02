// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry, TelemetryEvent } from "@lichtblick/suite-base/util/telemetry";

import { FrameCollector } from "./FrameCollector";
import { JsHeapCollector } from "./JsHeapCollector";
import { LongTaskCollector } from "./LongTaskCollector";
import { UaSpecificMemoryCollector } from "./UaSpecificMemoryCollector";
import { COLLECTOR_TICK_INTERVAL_MS } from "./constants";
import { CollectorPerformance, LongTaskObserverConstructor, RendererCollectorsEnv } from "./types";

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
 */
export class RendererCollectors {
  readonly #env: RendererCollectorsEnv;
  readonly #heap: JsHeapCollector;
  readonly #longTasks: LongTaskCollector;
  readonly #frames: FrameCollector;
  readonly #uaMemory: UaSpecificMemoryCollector;
  #timerHandle: unknown;
  #state: "idle" | "running" | "disposed" = "idle";

  readonly #tick = (): void => {
    this.#heap.sample();
    this.#frames.publish();
    this.#uaMemory.maybeMeasurePeriodic();
  };

  public constructor(telemetry: ITelemetry, env: RendererCollectorsEnv) {
    this.#env = env;
    this.#heap = new JsHeapCollector(telemetry, env.performance);
    this.#longTasks = new LongTaskCollector(telemetry, env.PerformanceObserver);
    this.#frames = new FrameCollector(telemetry, env);
    this.#uaMemory = new UaSpecificMemoryCollector(telemetry, env);
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
    this.#uaMemory.measure();
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
          this.#uaMemory.measure();
        }
        break;
      default:
        break;
    }
  }

  /** Records a final sample of the current window, then stops timers, RAF loop and observer. */
  public dispose(): void {
    if (this.#state !== "running") {
      this.#state = "disposed";
      return;
    }
    // Final partial window; no UA-memory measurement at teardown.
    this.#heap.sample();
    this.#frames.publish();
    this.#state = "disposed";
    this.#env.clearInterval(this.#timerHandle);
    this.#timerHandle = undefined;
    this.#frames.dispose();
    this.#longTasks.dispose();
    this.#uaMemory.dispose();
  }
}
