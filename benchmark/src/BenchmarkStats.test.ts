// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkStats } from "./BenchmarkStats";
import type { ListenerDispatchDurationSample } from "./types";

const mockLogInfo = jest.fn();

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: {
    getLogger: () => ({
      debug: jest.fn(),
      info: (...args: unknown[]) => mockLogInfo(...args),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  },
}));

type RecordGlobal = { recordFrameTimes?: (samples: ListenerDispatchDurationSample[]) => void };

const FLUSH_SAMPLE_COUNT = 100;

/** Records zeros until the singleton flushes, so every test starts with an empty buffer. */
function drainPendingSamples(recordFrameTimes: jest.Mock): void {
  for (let i = 0; i < FLUSH_SAMPLE_COUNT && recordFrameTimes.mock.calls.length === 0; i++) {
    BenchmarkStats.Instance().recordListenerDispatchDuration(0);
  }
  recordFrameTimes.mockClear();
  mockLogInfo.mockClear();
}

describe("BenchmarkStats.recordListenerDispatchDuration", () => {
  let recordFrameTimes: jest.Mock;

  beforeEach(() => {
    recordFrameTimes = jest.fn();
    (globalThis as RecordGlobal).recordFrameTimes = recordFrameTimes;
    drainPendingSamples(recordFrameTimes);
  });

  afterEach(() => {
    delete (globalThis as RecordGlobal).recordFrameTimes;
  });

  it("should not flush before 100 samples are recorded", () => {
    // Given
    const stats = BenchmarkStats.Instance();

    // When
    for (let i = 0; i < FLUSH_SAMPLE_COUNT - 1; i++) {
      stats.recordListenerDispatchDuration(1);
    }

    // Then
    expect(recordFrameTimes).not.toHaveBeenCalled();
  });

  it("should flush samples with the legacy fields plus a monotonic timestamp via window.recordFrameTimes", () => {
    // Given
    const stats = BenchmarkStats.Instance();
    const before = performance.timeOrigin + performance.now();

    // When
    for (let i = 0; i < FLUSH_SAMPLE_COUNT; i++) {
      stats.recordListenerDispatchDuration(i);
    }

    // Then
    expect(recordFrameTimes).toHaveBeenCalledTimes(1);
    const samples = recordFrameTimes.mock.calls[0]![0] as ListenerDispatchDurationSample[];
    expect(samples).toHaveLength(FLUSH_SAMPLE_COUNT);
    expect(samples[5]).toEqual({
      stamp: expect.any(Number),
      value: 5,
      monotonicTs: expect.any(Number),
    });
    expect(samples[0]!.monotonicTs).toBeGreaterThanOrEqual(before);
  });

  it("should keep the flushed batch intact once new samples are recorded", () => {
    // Given
    const stats = BenchmarkStats.Instance();
    for (let i = 0; i < FLUSH_SAMPLE_COUNT; i++) {
      stats.recordListenerDispatchDuration(i);
    }
    const flushed = recordFrameTimes.mock.calls[0]![0] as ListenerDispatchDurationSample[];

    // When
    stats.recordListenerDispatchDuration(42);

    // Then
    expect(flushed).toHaveLength(FLUSH_SAMPLE_COUNT);
  });

  it("should log the median and P90 using numeric (not lexicographic) ordering", () => {
    // Given: 1..100 in reverse; lexicographically "100" < "11" < "2", numerically 1 < 2 < ... < 100
    const stats = BenchmarkStats.Instance();

    // When
    for (let i = FLUSH_SAMPLE_COUNT; i >= 1; i--) {
      stats.recordListenerDispatchDuration(i);
    }

    // Then
    expect(mockLogInfo).toHaveBeenCalledTimes(1);
    const summary = String(mockLogInfo.mock.calls[0]![0]);
    expect(summary).toContain("listenerDispatchDurationMs");
    expect(summary).toContain("median: 51,");
    expect(summary).toContain("P90: 91,");
  });
});
