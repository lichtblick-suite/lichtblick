// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";
import { Opaque } from "ts-essentials";

// Ensure Symbol.dispose and Symbol.asyncDispose are defined
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Symbol as any).dispose ??= Symbol("Symbol.dispose");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Symbol as any).asyncDispose ??= Symbol("Symbol.asyncDispose");

export type PerformanceMetricID = Opaque<number, "PerformanceMetricID">;

export type PerformanceMetric = {
  id: PerformanceMetricID;
  /** Name, such as "Execution time" */
  name: string;
  /** Human-readable unit, such as "ms per frame" */
  unit: string;
};

/** An object that records performance timing information. */
export interface IPerformanceRegistry {
  /** Register a new metric with the given name and unit */
  registerMetric(metric: Omit<PerformanceMetric, "id">): PerformanceMetricID;
  /** Unregister a previously registered metric */
  unregisterMetric(metricId: PerformanceMetricID): void;

  /**
   * Record data for a metric.
   *
   * @param timestamp milliseconds, e.g. from performance.now()
   * @param value Arbitrary value, displayed with {@link PerformanceMetric.unit} for human-readability
   */
  addMeasurement(metricId: PerformanceMetricID, timestamp: number, value: number): void;

  /**
   * Starts measuring time and returns a Disposable that finishes & records the measurement when it
   * is disposed at the end of the enclosing scope. Use with `using timer = scopeTimer(...);`.
   *
   * https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management
   */
  scopeTimer(metricId: PerformanceMetricID): Disposable;
}

export const PerformanceContext = createContext<IPerformanceRegistry>({
  registerMetric() {
    return NaN as PerformanceMetricID;
  },
  unregisterMetric() {},
  addMeasurement() {},
  scopeTimer() {
    return { [Symbol.dispose]() {} };
  },
});

PerformanceContext.displayName = "PerformanceContext";

// ts-unused-exports:disable-next-line
export function usePerformance(): IPerformanceRegistry {
  return useContext(PerformanceContext);
}
