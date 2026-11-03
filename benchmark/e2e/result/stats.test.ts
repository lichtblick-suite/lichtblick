// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BOOTSTRAP_RESAMPLES } from "./constants";
import {
  bootstrapMedianCi95,
  interquartileRange,
  median,
  mulberry32,
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

describe("mulberry32", () => {
  it("should be deterministic per seed and return values in [0, 1)", () => {
    // Given two generators with the same seed and one with another
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);

    // When
    const seqA = Array.from({ length: 100 }, a);
    const seqB = Array.from({ length: 100 }, b);
    const seqC = Array.from({ length: 100 }, c);

    // Then
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    expect(seqA.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("bootstrapMedianCi95", () => {
  it("should return a deterministic interval that contains the sample median", () => {
    // Given ten deltas
    const values = [0.01, 0.02, -0.01, 0.015, 0.005, 0.03, 0, 0.012, 0.018, 0.007];

    // When
    const first = bootstrapMedianCi95(values);
    const second = bootstrapMedianCi95(values);

    // Then
    expect(first).toEqual(second);
    expect(first!.lower).toBeLessThanOrEqual(median(values)!);
    expect(first!.upper).toBeGreaterThanOrEqual(median(values)!);
    expect(first!.lower).toBeGreaterThanOrEqual(Math.min(...values));
    expect(first!.upper).toBeLessThanOrEqual(Math.max(...values));
  });

  it("should collapse to the value for one sample and to the constant for identical samples", () => {
    // Given / When / Then
    expect(bootstrapMedianCi95([0.5])).toEqual({ lower: 0.5, upper: 0.5 });
    expect(bootstrapMedianCi95([2, 2, 2])).toEqual({ lower: 2, upper: 2 });
    expect(bootstrapMedianCi95([])).toBeUndefined();
  });

  it("should depend on the seed and default to BOOTSTRAP_RESAMPLES resamples", () => {
    // Given skewed values
    const values = [1, 2, 3, 10, 20, 30, 100];

    // When
    const defaults = bootstrapMedianCi95(values);
    const explicit = bootstrapMedianCi95(values, { resamples: BOOTSTRAP_RESAMPLES });
    const otherSeed = bootstrapMedianCi95(values, { seed: 7, resamples: 50 });
    const sameOtherSeed = bootstrapMedianCi95(values, { seed: 7, resamples: 50 });

    // Then
    expect(defaults).toEqual(explicit);
    expect(otherSeed).toEqual(sameOtherSeed);
  });
});

describe("summarizeMetric", () => {
  it("should summarize the finite values only", () => {
    // Given values with an undefined and a NaN
    const values = [3, undefined, 1, Number.NaN, 2];

    // When
    const stats = summarizeMetric(values);

    // Then
    expect(stats.n).toBe(3);
    expect(stats.median).toBe(2);
    expect(stats.iqr).toBe(1);
    expect(stats.ci95).toBeDefined();
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
    const n = 5;

    // When
    const result = verdict(ci, 0.02, n);

    // Then
    expect(result).toBe(expected);
  });

  it("should be inconclusive with fewer than MIN_PAIRS_FOR_VERDICT pairs or without an interval", () => {
    // Given / When / Then
    expect(verdict({ lower: 0, upper: 0 }, 0.02, 2)).toBe("inconclusive");
    expect(verdict({ lower: 1, upper: 1 }, 0.02, 1)).toBe("inconclusive");
    expect(verdict(undefined, 0.02, 10)).toBe("inconclusive");
    expect(verdict({ lower: 0, upper: 0 }, 0.02, 3)).toBe("within");
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
