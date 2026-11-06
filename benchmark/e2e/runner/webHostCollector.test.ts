// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Browser } from "@playwright/test";
import { execFile } from "node:child_process";

import {
  WebHostCollector,
  computeCpuPercent,
  mapCdpProcessType,
  mapChromiumTypeSwitch,
  parsePsOutput,
  parsePsTreeOutput,
  selectProcessTree,
  toLegacyProcessMetric,
} from "./webHostCollector";

jest.mock("node:child_process", () => ({ execFile: jest.fn() }));

type ExecFileCallback = (error: Error | null, stdout: string) => void;

/** Makes every `ps` call print `stdout`. */
function mockPs(stdout: string): void {
  jest.mocked(execFile).mockImplementation(((
    _file: string,
    _args: string[],
    _options: object,
    cb: ExecFileCallback,
  ) => {
    cb(null, stdout);
  }) as unknown as typeof execFile);
}

/** A browser whose CDP session answers `SystemInfo.getProcessInfo` with `send`. */
function fakeBrowser(send: (method: string) => Promise<unknown>): Browser {
  const session = { send: jest.fn(send), detach: jest.fn(async () => undefined) };
  return { newBrowserCDPSession: jest.fn(async () => session) } as unknown as Browser;
}

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

  it("keeps args verbatim after the whitespace following pcpu", () => {
    // Given
    const lines = ["7\t1\t10\t0.5\t\t/a  b  ", "8 1 10 0.5    /c", "9 1 10 0.5 "].join("\n");

    // When
    const rows = parsePsTreeOutput(lines);

    // Then
    expect(rows.map((row) => row.args)).toEqual(["/a  b  ", "/c", ""]);
    expect(rows.map((row) => row.pid)).toEqual([7, 8, 9]);
  });

  it("ignores lines with missing or non-numeric columns", () => {
    // Given
    const lines = [
      "1 0 100 0.0",
      "1 0 100 x /a",
      "1 0 1e3 0.0 /a",
      "-1 0 100 0.0 /a",
      "1 0 100 0.0/a",
      "1 0 100 0.0 /a\r",
      "",
    ].join("\n");

    // When
    const rows = parsePsTreeOutput(lines);

    // Then
    expect(rows).toEqual([]);
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
    expect(computeCpuPercent(1, 3, -5)).toBeUndefined();
    expect(computeCpuPercent(1, 3, Number.NaN)).toBeUndefined();
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

describe("WebHostCollector.collect", () => {
  it("maps CDP processes with RSS from ps and CPU from the second poll on", async () => {
    // Given
    mockPs("10 2048\n11 4096\n");
    let cpuTime = 1;
    const browser = fakeBrowser(async () => ({
      processInfo: [
        { id: 10, type: "browser", cpuTime },
        { id: 11, type: "renderer", cpuTime: cpuTime * 2 },
      ],
    }));
    const collector = new WebHostCollector({ browser, marker: "--bench" });

    // When
    const first = await collector.collect(100);
    cpuTime = 2;
    const second = await collector.collect(200);

    // Then
    expect(first.samples.map((sample) => [sample.pid, sample.processType])).toEqual([
      [10, mapCdpProcessType("browser")],
      [11, mapCdpProcessType("renderer")],
    ]);
    expect(first.samples[0]!.cpuPercent).toBeUndefined();
    expect(second.samples[0]!.cpuPercent).toBeGreaterThan(0);
    expect(second.legacyMetrics).toHaveLength(2);
    expect(second.samples[1]!.workingSetBytes).toBe(4096 * 1024);
    await collector.dispose();
  });

  it("falls back to the marked ps process tree without CDP, warning once", async () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockPs(
      [
        "20 1 1000 5.0 /chrome --bench",
        "21 20 500 2.5 /chrome --type=renderer",
        "30 1 700 1.0 /other",
      ].join("\n"),
    );
    const browser = fakeBrowser(async () => {
      throw new Error("not supported");
    });
    const collector = new WebHostCollector({ browser, marker: "--bench" });

    // When
    const first = await collector.collect(1);
    await collector.collect(2);

    // Then
    expect(first.samples.map((sample) => [sample.pid, sample.cpuPercent])).toEqual([
      [20, 5],
      [21, 2.5],
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("WebHostCollector.readCumulativeCpu", () => {
  it("returns CDP's cumulative cpuTime per process with the cross-platform type", async () => {
    // Given
    const browser = fakeBrowser(async () => ({
      processInfo: [
        { id: 10, type: "browser", cpuTime: 4.5 },
        { id: 11, type: "renderer", cpuTime: 20.25 },
      ],
    }));
    const collector = new WebHostCollector({ browser, marker: "--bench" });

    // When
    const readings = await collector.readCumulativeCpu();

    // Then
    expect(readings).toEqual([
      { pid: 10, processType: mapCdpProcessType("browser"), cpuTimeSec: 4.5 },
      { pid: 11, processType: mapCdpProcessType("renderer"), cpuTimeSec: 20.25 },
    ]);
  });

  it("rejects without CDP instead of falling back to the decayed ps %cpu", async () => {
    // Given
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const browser = fakeBrowser(async () => {
      throw new Error("not supported");
    });
    const collector = new WebHostCollector({ browser, marker: "--bench" });

    // When / Then
    await expect(collector.readCumulativeCpu()).rejects.toThrow(
      "Cumulative CPU needs CDP SystemInfo.getProcessInfo",
    );
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
