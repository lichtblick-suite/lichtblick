// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Performance measurement utilities for point cloud rendering
 *
 * Usage:
 *   const perf = PointCloudPerformance.enable();
 *   // ... render point clouds ...
 *   const stats = perf.getStats();
 *   console.log(stats);
 *   perf.disable();
 */

type PerformanceSample = {
  timestamp: number;
  pointCount: number;
  updateTimeMs: number;
  minMaxTimeMs?: number;
};

class PointCloudPerformance {
  #enabled = false;
  #samples: PerformanceSample[] = [];
  #maxSamples = 1000;
  #currentUpdateStart = 0;
  #currentMinMaxStart = 0;
  #currentPointCount = 0;

  private constructor() {}

  /**
   * Enable performance measurement
   */
  public static enable(): PointCloudPerformance {
    const instance = new PointCloudPerformance();
    instance.#enabled = true;
    return instance;
  }

  /**
   * Disable performance measurement
   */
  public disable(): void {
    this.#enabled = false;
    this.#samples = [];
  }

  /**
   * Start measuring a point cloud update
   */
  public startUpdate(pointCount: number): void {
    if (!this.#enabled) {
      return;
    }
    this.#currentPointCount = pointCount;
    this.#currentUpdateStart = performance.now();
  }

  /**
   * Start measuring min/max calculation
   */
  public startMinMax(): void {
    if (!this.#enabled) {
      return;
    }
    this.#currentMinMaxStart = performance.now();
  }

  /**
   * End measuring min/max calculation
   */
  public endMinMax(): number {
    if (!this.#enabled || this.#currentMinMaxStart === 0) {
      return 0;
    }
    return performance.now() - this.#currentMinMaxStart;
  }

  /**
   * End measuring a point cloud update and record the sample
   */
  public endUpdate(minMaxTimeMs?: number): void {
    if (!this.#enabled || this.#currentUpdateStart === 0) {
      return;
    }

    const updateTimeMs = performance.now() - this.#currentUpdateStart;
    const sample: PerformanceSample = {
      timestamp: performance.now(),
      pointCount: this.#currentPointCount,
      updateTimeMs,
      minMaxTimeMs,
    };

    this.#samples.push(sample);
    if (this.#samples.length > this.#maxSamples) {
      this.#samples.shift();
    }

    // Reset
    this.#currentUpdateStart = 0;
    this.#currentPointCount = 0;
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    totalSamples: number;
    averageUpdateTimeMs: number;
    minUpdateTimeMs: number;
    maxUpdateTimeMs: number;
    averagePointsPerSecond: number;
    averageMinMaxTimeMs?: number;
    recentSamples: PerformanceSample[];
  } {
    if (this.#samples.length === 0) {
      return {
        totalSamples: 0,
        averageUpdateTimeMs: 0,
        minUpdateTimeMs: 0,
        maxUpdateTimeMs: 0,
        averagePointsPerSecond: 0,
        recentSamples: [],
      };
    }

    const updateTimes = this.#samples.map((s) => s.updateTimeMs);
    const minMaxTimes = this.#samples
      .map((s) => s.minMaxTimeMs)
      .filter((t): t is number => t !== undefined);

    const totalUpdateTime = updateTimes.reduce((a, b) => a + b, 0);
    const averageUpdateTimeMs = totalUpdateTime / this.#samples.length;
    const minUpdateTimeMs = Math.min(...updateTimes);
    const maxUpdateTimeMs = Math.max(...updateTimes);

    const totalPoints = this.#samples.reduce((sum, s) => sum + s.pointCount, 0);
    const averagePointsPerSecond =
      totalPoints > 0 && totalUpdateTime > 0
        ? (totalPoints / totalUpdateTime) * 1000
        : 0;

    const averageMinMaxTimeMs =
      minMaxTimes.length > 0
        ? minMaxTimes.reduce((a, b) => a + b, 0) / minMaxTimes.length
        : undefined;

    // Get last 10 samples
    const recentSamples = this.#samples.slice(-10);

    return {
      totalSamples: this.#samples.length,
      averageUpdateTimeMs,
      minUpdateTimeMs,
      maxUpdateTimeMs,
      averagePointsPerSecond,
      averageMinMaxTimeMs,
      recentSamples,
    };
  }

  /**
   * Log performance statistics to console
   */
  public logStats(): void {
    const stats = this.getStats();
    console.group("Point Cloud Performance Stats");
    console.log(`Total samples: ${stats.totalSamples}`);
    console.log(`Average update time: ${stats.averageUpdateTimeMs.toFixed(2)}ms`);
    console.log(`Min update time: ${stats.minUpdateTimeMs.toFixed(2)}ms`);
    console.log(`Max update time: ${stats.maxUpdateTimeMs.toFixed(2)}ms`);
    console.log(`Average points/second: ${stats.averagePointsPerSecond.toFixed(0)}`);
    if (stats.averageMinMaxTimeMs !== undefined) {
      console.log(`Average min/max time: ${stats.averageMinMaxTimeMs.toFixed(2)}ms`);
    }
    console.log("Recent samples:", stats.recentSamples);
    console.groupEnd();
  }

  /**
   * Clear all samples
   */
  public clear(): void {
    this.#samples = [];
  }
}

// Global instance for easy access
let globalPerf: PointCloudPerformance | undefined;

/**
 * Enable global performance measurement
 * Call this in the browser console or in your code
 */
export function enablePointCloudPerformance(): PointCloudPerformance {
  globalPerf = PointCloudPerformance.enable();
  console.log("Point cloud performance measurement enabled");
  return globalPerf;
}

/**
 * Disable global performance measurement
 */
export function disablePointCloudPerformance(): void {
  if (globalPerf) {
    globalPerf.disable();
    globalPerf = undefined;
    console.log("Point cloud performance measurement disabled");
  }
}

/**
 * Get global performance statistics
 */
export function getPointCloudPerformanceStats() {
  if (!globalPerf) {
    console.warn("Performance measurement not enabled. Call enablePointCloudPerformance() first.");
    return null;
  }
  return globalPerf.getStats();
}

/**
 * Log global performance statistics
 */
export function logPointCloudPerformanceStats(): void {
  if (!globalPerf) {
    console.warn("Performance measurement not enabled. Call enablePointCloudPerformance() first.");
    return;
  }
  globalPerf.logStats();
}

/**
 * Get the global performance instance (for internal use)
 */
export function getPointCloudPerformanceInstance(): PointCloudPerformance | undefined {
  return globalPerf;
}

export { PointCloudPerformance };
