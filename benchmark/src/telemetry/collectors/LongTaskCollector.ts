// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import { LONG_TASK_ENTRY_TYPE, RENDERER_METRICS } from "./constants";
import { LongTaskEntryList, LongTaskObserver, LongTaskObserverConstructor } from "./types";

const log = Logger.getLogger(__filename);

/**
 * Counts main-thread long tasks (Long Tasks API, Chromium) into `renderer.longTasks.count` and
 * `renderer.longTasks.durationMs`. Uses `buffered: true` so long tasks that happened before the
 * observer started (e.g. during bootstrap) are counted too. No-op where unsupported.
 */
export class LongTaskCollector {
  readonly #telemetry: ITelemetry;
  readonly #Observer: LongTaskObserverConstructor | undefined;
  #observer: LongTaskObserver | undefined;

  readonly #onEntries = (list: LongTaskEntryList): void => {
    const entries = list.getEntries();
    let durationMs = 0;
    for (const entry of entries) {
      durationMs += entry.duration;
    }
    if (entries.length === 0) {
      return;
    }
    this.#telemetry.counter(RENDERER_METRICS.longTasksCount, entries.length, "count", "renderer");
    this.#telemetry.counter(RENDERER_METRICS.longTasksDurationMs, durationMs, "ms", "renderer");
  };

  public constructor(telemetry: ITelemetry, Observer: LongTaskObserverConstructor | undefined) {
    this.#telemetry = telemetry;
    this.#Observer = Observer;
  }

  public isSupported(): boolean {
    return this.#Observer?.supportedEntryTypes?.includes(LONG_TASK_ENTRY_TYPE) === true;
  }

  /** Starts observing. Idempotent; no-op if unsupported. */
  public start(): void {
    if (this.#observer != undefined || !this.isSupported() || this.#Observer == undefined) {
      return;
    }
    try {
      const observer = new this.#Observer(this.#onEntries);
      observer.observe({ type: LONG_TASK_ENTRY_TYPE, buffered: true });
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
