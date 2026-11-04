// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import { SelfCostCounter, SelfCostMeter } from "./SelfCostMeter";
import { LONG_TASK_ENTRY_TYPE, RENDERER_METRICS } from "./constants";
import { LongTaskEntryList, LongTaskObserver, LongTaskObserverConstructor } from "./types";

const log = Logger.getLogger(__filename);

function performanceNow(): number {
  return performance.now();
}

/**
 * Counts main-thread long tasks (Long Tasks API, Chromium) into `renderer.longTasks.count` and
 * `renderer.longTasks.durationMs`. Uses `buffered: true` by default so long tasks that happened
 * before the observer started (e.g. during bootstrap) are counted too. No-op where unsupported. The time spent
 * inside the observer callback is accumulated into `telemetry.self.timeMs.longTasks`.
 */
export class LongTaskCollector {
  readonly #telemetry: ITelemetry;
  readonly #Observer: LongTaskObserverConstructor | undefined;
  /** Time spent inside the observer callback (`telemetry.self.timeMs.longTasks`). */
  readonly #selfTime: SelfCostCounter;
  #observer: LongTaskObserver | undefined;

  readonly #onEntries = (list: LongTaskEntryList): void => {
    const selfStartMs = this.#selfTime.now();
    const entries = list.getEntries();
    if (entries.length > 0) {
      let durationMs = 0;
      for (const entry of entries) {
        durationMs += entry.duration;
      }
      this.#telemetry.counter(RENDERER_METRICS.longTasksCount, entries.length, "count", "renderer");
      this.#telemetry.counter(RENDERER_METRICS.longTasksDurationMs, durationMs, "ms", "renderer");
    }
    this.#selfTime.addSince(selfStartMs);
  };

  public constructor(
    telemetry: ITelemetry,
    Observer: LongTaskObserverConstructor | undefined,
    selfCost: SelfCostMeter = new SelfCostMeter(performanceNow),
  ) {
    this.#telemetry = telemetry;
    this.#Observer = Observer;
    this.#selfTime = selfCost.counter("longTasksMs");
  }

  public isSupported(): boolean {
    return this.#Observer?.supportedEntryTypes?.includes(LONG_TASK_ENTRY_TYPE) === true;
  }

  /**
   * Starts observing (also after `dispose()`). Idempotent; no-op if unsupported. `buffered: false`
   * skips long tasks that ended before this call (resume after a pause).
   */
  public start({ buffered = true }: { buffered?: boolean } = {}): void {
    if (this.#observer != undefined || !this.isSupported() || this.#Observer == undefined) {
      return;
    }
    try {
      const observer = new this.#Observer(this.#onEntries);
      observer.observe({ type: LONG_TASK_ENTRY_TYPE, buffered });
      this.#observer = observer;
    } catch (err: unknown) {
      log.debug("Long task observer unavailable", err);
    }
  }

  public dispose(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
  }
}
