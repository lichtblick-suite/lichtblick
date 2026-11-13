// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MIN_PAIRS_FOR_VERDICT } from "./constants";
import {
  binomialHalfCdf,
  interquartileRange,
  medianCi95,
  medianCiRanks,
  summarizeMetric,
  verdict,
  worstVerdict,
} from "./stats";

describe("interquartileRange", () => {
  it("should interpolate linearly between order statistics regardless of input order", () => {
    // Given unsorted values 1..4
    const values = [4, 1, 3, 2];

    // When
    const iqr = interquartileRange(values);

    // Then q75 = 3.25 and q25 = 1.75
    expect(iqr).toBeCloseTo(1.5);
  });

  it("should return undefined without values", () => {
    // Given / When / Then
    expect(interquartileRange([])).toBeUndefined();
  });
});

describe("binomialHalfCdf", () => {
  it.each([
    [-1, 6, 0],
    [0, 6, 1 / 64],
    [1, 6, 7 / 64],
    [2, 10, 56 / 1024],
    [6, 6, 1],
  ])("should return P(B ≤ %d) for n = %d as %d", (k, n, expected) => {
    // Given / When
    const cdf = binomialHalfCdf(k, n);

    // Then
    expect(cdf).toBeCloseTo(expected, 12);
  });

  it("should not underflow for large n", () => {
    // Given / When
    const cdf = binomialHalfCdf(1100, 2000);

    // Then the upper tail above the mean is close to 0, so the CDF is close to 1
    expect(cdf).toBeGreaterThan(0.99);
  });
});

describe("medianCiRanks", () => {
  it.each([1, 2, 3, 4, 5])("should return undefined for n = %d (no 95 %% interval exists)", (n) => {
    // Given / When
    const ranks = medianCiRanks(n);

    // Then
    expect(ranks).toBeUndefined();
  });

  it.each([
    [6, 1, 6, 1 - 2 / 64],
    [7, 1, 7, 1 - 2 / 128],
    [8, 1, 8, 1 - 2 / 256],
    [9, 2, 8, 1 - (2 * 10) / 512],
    [10, 2, 9, 1 - (2 * 11) / 1024],
  ])("should bound n = %d by ranks %d..%d with exact coverage %d", (n, lower, upper, coverage) => {
    // Given / When
    const ranks = medianCiRanks(n);

    // Then
    expect(ranks).toEqual({ lower, upper, coverage: expect.closeTo(coverage, 12) });
  });

  it("should pick the narrowest interval that still reaches the confidence", () => {
    // Given n = 30
    const n = 30;

    // When
    const ranks = medianCiRanks(n)!;
    const wider = 1 - 2 * binomialHalfCdf(ranks.lower - 1, n);
    const narrower = 1 - 2 * binomialHalfCdf(ranks.lower, n);

    // Then
    expect(wider).toBeGreaterThanOrEqual(0.95);
    expect(narrower).toBeLessThan(0.95);
  });
});

describe("medianCi95", () => {
  it("should return [min, max] for six values regardless of input order", () => {
    // Given six unsorted deltas
    const values = [0.03, -0.01, 0.01, 0.02, 0, 0.015];

    // When
    const ci = medianCi95(values);

    // Then
    expect(ci).toEqual({ lower: -0.01, upper: 0.03 });
  });

  it("should return the 2nd and 9th order statistics for ten values", () => {
    // Given ten deltas
    const values = [0.01, 0.02, -0.01, 0.015, 0.005, 0.03, 0, 0.012, 0.018, 0.007];

    // When
    const ci = medianCi95(values);

    // Then sorted: -0.01, 0, 0.005, 0.007, 0.01, 0.012, 0.015, 0.018, 0.02, 0.03
    expect(ci).toEqual({ lower: 0, upper: 0.02 });
  });

  it("should collapse to the constant for identical values", () => {
    // Given / When
    const ci = medianCi95([2, 2, 2, 2, 2, 2]);

    // Then
    expect(ci).toEqual({ lower: 2, upper: 2 });
  });

  it("should return undefined with fewer than six values", () => {
    // Given / When
    const ci = medianCi95([1, 2, 3, 4, 5]);

    // Then
    expect(ci).toBeUndefined();
  });
});

describe("summarizeMetric", () => {
  it("should summarize the finite values only", () => {
    // Given six finite values plus an undefined and a NaN
    const values = [3, undefined, 1, Number.NaN, 2, 4, 6, 5];

    // When
    const stats = summarizeMetric(values);

    // Then
    expect(stats).toEqual({ n: 6, median: 3.5, iqr: 2.5, ci95: { lower: 1, upper: 6 } });
  });

  it("should omit the interval with fewer than six finite values", () => {
    // Given three values
    const values = [3, 1, 2];

    // When
    const stats = summarizeMetric(values);

    // Then
    expect(stats).toEqual({ n: 3, median: 2, iqr: 1 });
  });

  it("should return n = 0 without finite values", () => {
    // Given / When / Then
    expect(summarizeMetric([undefined])).toEqual({ n: 0 });
  });
});

describe("verdict", () => {
  it.each([
    [{ lower: -0.01, upper: 0.02 }, "within"],
    [{ lower: 0.021, upper: 0.05 }, "exceeds"],
    [{ lower: 0.01, upper: 0.03 }, "inconclusive"],
  ] as const)("should classify %j against 0.02 as %s", (ci, expected) => {
    // Given enough pairs
    const n = MIN_PAIRS_FOR_VERDICT;

    // When
    const result = verdict(ci, 0.02, n);

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    ["fewer than MIN_PAIRS_FOR_VERDICT pairs", { lower: 0, upper: 0 }, MIN_PAIRS_FOR_VERDICT - 1],
    ["fewer than MIN_PAIRS_FOR_VERDICT pairs above the target", { lower: 1, upper: 1 }, 1],
    ["no interval", undefined, 10],
  ])("should be inconclusive with %s", (_label, ci, n) => {
    // Given / When
    const result = verdict(ci, 0.02, n);

    // Then
    expect(result).toBe("inconclusive");
  });

  it("should give a verdict from MIN_PAIRS_FOR_VERDICT pairs on", () => {
    // Given / When
    const result = verdict({ lower: 0, upper: 0 }, 0.02, MIN_PAIRS_FOR_VERDICT);

    // Then
    expect(result).toBe("within");
  });
});

describe("worstVerdict", () => {
  it("should rank exceeds over inconclusive over within", () => {
    // Given / When / Then
    expect(worstVerdict(["within", "exceeds", "inconclusive"])).toBe("exceeds");
    expect(worstVerdict(["within", "inconclusive"])).toBe("inconclusive");
    expect(worstVerdict(["within", "within"])).toBe("within");
    expect(worstVerdict([])).toBe("inconclusive");
  });
});
