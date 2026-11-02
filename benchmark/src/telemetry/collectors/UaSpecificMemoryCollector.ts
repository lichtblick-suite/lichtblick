// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import { RENDERER_METRICS, UA_MEMORY_MIN_INTERVAL_MS } from "./constants";
import { UaSpecificMemoryCollectorEnv } from "./types";

const log = Logger.getLogger(__filename);

/**
 * Measures `performance.measureUserAgentSpecificMemory()` into gauge
 * `renderer.uaSpecificMemory.bytes`. Only active when the page is cross-origin isolated and the API
 * exists (Chromium). The browser may delay the result until its next GC, so:
 * - at most one measurement is in flight; a request arriving meanwhile is coalesced into one
 *   follow-up measurement started when the current one settles;
 * - periodic measurements (`maybeMeasurePeriodic`) are spaced at least `UA_MEMORY_MIN_INTERVAL_MS`
 *   apart from the previous measurement start.
 * Errors are swallowed (debug log): telemetry must never affect the app.
 */
export class UaSpecificMemoryCollector {
  readonly #telemetry: ITelemetry;
  readonly #env: UaSpecificMemoryCollectorEnv;
  #inFlight = false;
  #pending = false;
  #disposed = false;
  #lastStartedAtMs: number | undefined;

  public constructor(telemetry: ITelemetry, env: UaSpecificMemoryCollectorEnv) {
    this.#telemetry = telemetry;
    this.#env = env;
  }

  public isSupported(): boolean {
    return (
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
    try {
      const result = await performance.measureUserAgentSpecificMemory();
      if (!this.#disposed) {
        this.#telemetry.gauge(
          RENDERER_METRICS.uaSpecificMemoryBytes,
          result.bytes,
          "bytes",
          "renderer",
        );
      }
    } catch (err: unknown) {
      log.debug("measureUserAgentSpecificMemory failed", err);
    } finally {
      this.#inFlight = false;
    }
    if (this.#pending && !this.#disposed) {
      this.#pending = false;
      void this.#run();
    }
  }
}
