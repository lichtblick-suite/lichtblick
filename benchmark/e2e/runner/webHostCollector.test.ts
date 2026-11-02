// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  computeCpuPercent,
  mapCdpProcessType,
  mapChromiumTypeSwitch,
  parsePsOutput,
  parsePsTreeOutput,
  selectProcessTree,
  toLegacyProcessMetric,
} from "./webHostCollector";

describe("mapCdpProcessType", () => {
  it.each([
    ["browser", "browser"],
    ["renderer", "renderer"],
    ["GPU", "gpu"],
    ["network.mojom.NetworkService", "utility"],
    ["storage.mojom.StorageService", "utility"],
    ["audio.mojom.AudioService", "utility"],
    ["utility", "utility"],
    ["zygote", "zygote"],
  ])("maps %s to %s", (type, expected) => {
    // Given a CDP process type / When mapped / Then
    expect(mapCdpProcessType(type)).toBe(expected);
  });
});

describe("mapChromiumTypeSwitch", () => {
  it.each([
    ["/path/chrome --headless --lichtblick-benchmark-run=x", "browser"],
    ["/path/chrome --type=renderer --enable-foo", "renderer"],
    ["/path/chrome --type=gpu-process", "gpu"],
    ["/path/chrome --type=utility --utility-sub-type=network.mojom.NetworkService", "utility"],
    ["/path/chrome --type=zygote", "zygote"],
  ])("maps `%s` to %s", (args, expected) => {
    // Given a command line / When mapped / Then
    expect(mapChromiumTypeSwitch(args)).toBe(expected);
  });
});

describe("parsePsOutput", () => {
  it("parses pid/rss pairs and ignores blank or malformed lines", () => {
    // Given padded ps output (as printed by macOS and procps)
    const stdout = "  123  45678\n 9   10\n\ngarbage\n 77\n";

    // When
    const result = parsePsOutput(stdout);

    // Then
    expect([...result]).toEqual([
      [123, 45678],
      [9, 10],
    ]);
  });
});

describe("parsePsTreeOutput / selectProcessTree", () => {
  const stdout = [
    "    1     0   100  0.0 /sbin/init",
    "  500     1  2000  5.5 /chrome --headless --lichtblick-benchmark-run=abc",
    "  501   500  3000 12.0 /chrome --type=renderer --lichtblick-benchmark-run=abc",
    "  502   500  1000  1.0 /chrome --type=gpu-process",
    "  503   502   500  0.5 /chrome --type=utility",
    "  600     1  9999 99.0 /chrome --headless --lichtblick-benchmark-run=other",
    "bad line",
  ].join("\n");

  it("parses rows including args with spaces", () => {
    // Given / When
    const rows = parsePsTreeOutput(stdout);

    // Then
    expect(rows).toHaveLength(6);
    expect(rows[1]).toEqual({
      pid: 500,
      ppid: 1,
      rssKb: 2000,
      cpuPercent: 5.5,
      args: "/chrome --headless --lichtblick-benchmark-run=abc",
    });
  });

  it("selects the marked browser process and all its descendants", () => {
    // Given
    const rows = parsePsTreeOutput(stdout);

    // When
    const tree = selectProcessTree(rows, "--lichtblick-benchmark-run=abc");

    // Then
    expect(tree.map((row) => row.pid)).toEqual([500, 501, 502, 503]);
  });

  it("returns nothing when the marker is not found", () => {
    // Given / When / Then
    expect(selectProcessTree(parsePsTreeOutput(stdout), "--missing")).toEqual([]);
  });
});

describe("computeCpuPercent", () => {
  it("computes percent of one core from cumulative CPU seconds", () => {
    // Given 0.5 CPU seconds used over 1000 ms / When / Then
    expect(computeCpuPercent(2, 2.5, 1000)).toBeCloseTo(50);
    // And multi-core usage can exceed 100 %
    expect(computeCpuPercent(0, 3, 1000)).toBeCloseTo(300);
  });

  it("returns undefined without a previous reading or interval and clamps negatives", () => {
    // Given / When / Then
    expect(computeCpuPercent(undefined, 3, 1000)).toBeUndefined();
    expect(computeCpuPercent(1, 3, 0)).toBeUndefined();
    expect(computeCpuPercent(5, 3, 1000)).toBe(0);
  });
});

describe("toLegacyProcessMetric", () => {
  it("builds a ProcessMetric-compatible entry in KB with zero defaults", () => {
    // Given / When / Then
    expect(
      toLegacyProcessMetric({
        monotonicTs: 1,
        pid: 7,
        processType: "renderer",
        workingSetBytes: 2048,
        peakWorkingSetBytes: 4096,
        cpuPercent: 3,
      }),
    ).toEqual({
      pid: 7,
      type: "renderer",
      memory: { workingSetSize: 2, peakWorkingSetSize: 4 },
      cpu: { percentCPUUsage: 3 },
    });
    expect(toLegacyProcessMetric({ monotonicTs: 1, pid: 8, processType: "gpu" })).toEqual({
      pid: 8,
      type: "gpu",
      memory: { workingSetSize: 0, peakWorkingSetSize: 0 },
      cpu: { percentCPUUsage: 0 },
    });
  });
});
