// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import { SelfCostCounter, SelfCostMeter } from "./SelfCostMeter";
import {
  RENDERER_METRICS,
  UA_MEMORY_MIN_INTERVAL_MS,
  UA_MEMORY_UNAVAILABLE_ERROR_NAME,
} from "./constants";
import { UaSpecificMemoryCollectorEnv } from "./types";

const log = Logger.getLogger(__filename);

/** True for the rejection of a browser that does not provide the API (see the constant). */
function isUnavailableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != undefined &&
    (err as { name?: unknown }).name === UA_MEMORY_UNAVAILABLE_ERROR_NAME
  );
}

/**
 * Measures `performance.measureUserAgentSpecificMemory()` into gauge
 * `renderer.uaSpecificMemory.bytes`. Only active when the page is cross-origin isolated and the API
 * exists (Chromium). The browser may delay the result until its next GC, so:
 * - at most one measurement is in flight; a request arriving meanwhile is coalesced into one
 *   follow-up measurement started when the current one settles;
 * - periodic measurements (`maybeMeasurePeriodic`) are spaced at least `UA_MEMORY_MIN_INTERVAL_MS`
 *   apart from the previous measurement start.
 * Errors are swallowed (debug log): telemetry must never affect the app.
 *
 * A `SecurityError` rejection means the browser does not provide the API although the method exists
 * (e.g. `chromium-headless-shell`): the collector then reports itself unsupported and stops calling.
 *
 * Self cost: `telemetry.self.uaMemory.calls` counts calls, `telemetry.self.timeMs.uaMemory` sums
 * the synchronous part of each call, `telemetry.self.uaMemory.resolveMs` sums call -> resolve
 * latency of the calls that resolved, counted by `telemetry.self.uaMemory.resolved` (its
 * denominator); rejections are counted by `telemetry.self.uaMemory.failures`. Calls still in flight
 * are in neither.
 */
export class UaSpecificMemoryCollector {
  readonly #telemetry: ITelemetry;
  readonly #env: UaSpecificMemoryCollectorEnv;
  readonly #selfCalls: SelfCostCounter;
  readonly #selfSyncTime: SelfCostCounter;
  readonly #selfResolveTime: SelfCostCounter;
  readonly #selfResolved: SelfCostCounter;
  readonly #selfFailures: SelfCostCounter;
  #inFlight = false;
  #pending = false;
  #disposed = false;
  /** Set by a `SecurityError` rejection: the browser does not provide the API. */
  #unavailable = false;
  #lastStartedAtMs: number | undefined;

  public constructor(
    telemetry: ITelemetry,
    env: UaSpecificMemoryCollectorEnv,
    selfCost: SelfCostMeter = new SelfCostMeter(env.now),
  ) {
    this.#telemetry = telemetry;
    this.#env = env;
    this.#selfCalls = selfCost.counter("uaMemoryCalls");
    this.#selfSyncTime = selfCost.counter("uaMemoryMs");
    this.#selfResolveTime = selfCost.counter("uaMemoryResolveMs");
    this.#selfResolved = selfCost.counter("uaMemoryResolved");
    this.#selfFailures = selfCost.counter("uaMemoryFailures");
  }

  public isSupported(): boolean {
    return (
      !this.#unavailable &&
      this.#env.crossOriginIsolated === true &&
      typeof this.#env.performance?.measureUserAgentSpecificMemory === "function"
    );
  }

  /** Requests a measurement now (or right after the in-flight one settles). */
  public measure(): void {
    if (this.#disposed || !this.isSupported()) {
      return;
    }
    if (this.#inFlight) {
      this.#pending = true;
      return;
    }
    void this.#run();
  }

  /** Requests a measurement if the previous one started at least `UA_MEMORY_MIN_INTERVAL_MS` ago. */
  public maybeMeasurePeriodic(): void {
    if (this.#inFlight) {
      return;
    }
    const last = this.#lastStartedAtMs;
    if (last != undefined && this.#env.now() - last < UA_MEMORY_MIN_INTERVAL_MS) {
      return;
    }
    this.measure();
  }

  public dispose(): void {
    this.#disposed = true;
    this.#pending = false;
  }

  async #run(): Promise<void> {
    const performance = this.#env.performance;
    if (performance?.measureUserAgentSpecificMemory == undefined) {
      return;
    }
    this.#inFlight = true;
    this.#lastStartedAtMs = this.#env.now();
    this.#selfCalls.add(1);
    const callStartMs = this.#selfSyncTime.now();
    try {
      const pendingResult = performance.measureUserAgentSpecificMemory();
      this.#selfSyncTime.addSince(callStartMs);
      const result = await pendingResult;
      this.#selfResolveTime.addSince(callStartMs);
      this.#selfResolved.add(1);
      if (!this.#disposed) {
        this.#telemetry.gauge(
          RENDERER_METRICS.uaSpecificMemoryBytes,
          result.bytes,
          "bytes",
          "renderer",
        );
      }
    } catch (err: unknown) {
      this.#selfFailures.add(1);
      if (isUnavailableError(err)) {
        this.#unavailable = true;
      }
      log.debug("measureUserAgentSpecificMemory failed", err);
    } finally {
      this.#inFlight = false;
    }
    if (this.#pending && !this.#disposed && !this.#unavailable) {
      this.#pending = false;
      void this.#run();
    }
  }
}
