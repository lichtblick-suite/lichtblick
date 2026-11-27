// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import os from "node:os";

import { logicalCpuCount, toPerCoreSumPercent } from "./hostCpus";

describe("toPerCoreSumPercent", () => {
  it.each([
    [1.25, 8, 10],
    [15, 14, 210],
    [0, 4, 0],
    [50, 1, 50],
  ])("should scale %s %% of all CPUs on %s CPUs to %s %% summed over cores", (percent, cpus, expected) => {
    // Given Electron's percentCPUUsage (divided by the logical CPU count)
    // When converted to the per-core-sum scale
    const result = toPerCoreSumPercent(percent, cpus);

    // Then it is the usage summed over cores (100 % = one full core)
    expect(result).toBeCloseTo(expected);
  });
});

describe("logicalCpuCount", () => {
  it("should return the logical CPUs available to the process", () => {
    // Given / When
    const count = logicalCpuCount();

    // Then
    expect(count).toBe(os.availableParallelism());
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
