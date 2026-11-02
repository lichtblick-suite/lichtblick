// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import {
  ChromiumPerformanceMemory,
  CollectorPerformance,
  LongTaskEntryList,
  LongTaskObserverConstructor,
  RendererCollectorsEnv,
  UserAgentSpecificMemoryResult,
} from "../types";

/** `ITelemetry` whose methods are jest mocks. */
export type MockTelemetry = { [K in keyof ITelemetry]: jest.Mock };

export function buildMockTelemetry(): MockTelemetry {
  return {
    isEnabled: jest.fn(() => true),
    gauge: jest.fn(),
    counter: jest.fn(),
    observe: jest.fn(),
    event: jest.fn(),
    ingest: jest.fn(),
  };
}

/** Manually driven `requestAnimationFrame`: call `fireFrame(ts)` to run the pending callback. */
export class FakeAnimationFrames {
  #nextHandle = 1;
  #pending: { handle: number; callback: (ts: number) => void } | undefined;
  public readonly requestAnimationFrame = jest.fn((callback: (ts: number) => void): number => {
    const handle = this.#nextHandle++;
    this.#pending = { handle, callback };
    return handle;
  });
  public readonly cancelAnimationFrame = jest.fn((handle: number): void => {
    if (this.#pending?.handle === handle) {
      this.#pending = undefined;
    }
  });

  public hasPending(): boolean {
    return this.#pending != undefined;
  }

  public fireFrame(timestamp: number): void {
    const pending = this.#pending;
    this.#pending = undefined;
    pending?.callback(timestamp);
  }
}

/** Fake `PerformanceObserver` recording the latest instance so tests can push entries. */
export function buildFakeLongTaskObserver(supportedEntryTypes: readonly string[] = ["longtask"]): {
  Observer: LongTaskObserverConstructor;
  instances: Array<{
    callback: (list: LongTaskEntryList) => void;
    observe: jest.Mock;
    disconnect: jest.Mock;
  }>;
} {
  const instances: Array<{
    callback: (list: LongTaskEntryList) => void;
    observe: jest.Mock;
    disconnect: jest.Mock;
  }> = [];
  class FakeObserver {
    public static readonly supportedEntryTypes = supportedEntryTypes;
    public readonly observe = jest.fn();
    public readonly disconnect = jest.fn();
    public constructor(callback: (list: LongTaskEntryList) => void) {
      instances.push({ callback, observe: this.observe, disconnect: this.disconnect });
    }
  }
  return { Observer: FakeObserver, instances };
}

/** Builder for a fully fake `RendererCollectorsEnv` (Jest fake timers drive the interval). */
export class RendererCollectorsEnvBuilder {
  #now = 0;
  #memory: ChromiumPerformanceMemory | undefined;
  #measureUaMemory: (() => Promise<UserAgentSpecificMemoryResult>) | undefined;
  #crossOriginIsolated = false;
  #frames: FakeAnimationFrames | undefined = new FakeAnimationFrames();
  #Observer: LongTaskObserverConstructor | undefined;

  public withMemory(memory: ChromiumPerformanceMemory): this {
    this.#memory = memory;
    return this;
  }

  public withUaMemory(measure: () => Promise<UserAgentSpecificMemoryResult>): this {
    this.#measureUaMemory = measure;
    this.#crossOriginIsolated = true;
    return this;
  }

  public withFrames(frames: FakeAnimationFrames | undefined): this {
    this.#frames = frames;
    return this;
  }

  public withLongTaskObserver(Observer: LongTaskObserverConstructor | undefined): this {
    this.#Observer = Observer;
    return this;
  }

  /** `clock.now` is mutable so tests can advance the collectors' monotonic clock. */
  public build(): { env: RendererCollectorsEnv; clock: { now: number } } {
    const clock = { now: this.#now };
    const performance: CollectorPerformance = {};
    if (this.#memory != undefined) {
      Object.assign(performance, { memory: this.#memory });
    }
    if (this.#measureUaMemory != undefined) {
      performance.measureUserAgentSpecificMemory = this.#measureUaMemory;
    }
    const frames = this.#frames;
    const env: RendererCollectorsEnv = {
      now: () => clock.now,
      setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
      clearInterval: (handle) => {
        clearInterval(handle as ReturnType<typeof setInterval>);
      },
      requestAnimationFrame: frames?.requestAnimationFrame,
      cancelAnimationFrame: frames?.cancelAnimationFrame,
      performance,
      PerformanceObserver: this.#Observer,
      crossOriginIsolated: this.#crossOriginIsolated,
    };
    return { env, clock };
  }
}
