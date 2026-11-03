// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";
import {
  buildRunChartData,
  counterRatePoints,
  downsample,
  findOverhead,
  formatRunTime,
  matchScreenshots,
  newestFinishedAtMs,
  observationMeanPoints,
  parseOverheadFile,
  parseResultFile,
  runStem,
  selectRuns,
  staleHours,
} from "./htmlReportData";
import { Point } from "./types";
import { TelemetryRecordBuilder } from "../result/builders/TelemetryRecordBuilder";
import { OverheadRunBuilder } from "../runner/builders/OverheadRunBuilder";

const identity = (ts: number) => ts / 1000;

describe("parseResultFile", () => {
  it("accepts a valid benchmark-result.v1", () => {
    // Given
    const result = BenchmarkResultBuilder.result();

    // When
    const outcome = parseResultFile("a.benchmark-result.v1.json", JSON.stringify(result));

    // Then
    expect(outcome.ok).toBe(true);
  });

  it("should accept an older result without run.scenario and render calibration", () => {
    // Given
    const legacy = BenchmarkResultBuilder.legacy();

    // When
    const outcome = parseResultFile("old.benchmark-result.v1.json", JSON.stringify(legacy));

    // Then
    expect(outcome.ok).toBe(true);
    expect(outcome.ok ? outcome.value.result.run.scenario : "error").toBeUndefined();
  });

  it("should keep written summary.kpis as they are", () => {
    // Given
    const result = BenchmarkResultBuilder.result();

    // When
    const outcome = parseResultFile("a.benchmark-result.v1.json", JSON.stringify(result));

    // Then
    expect(outcome.ok ? outcome.value.result.summary.kpis : "error").toEqual(result.summary.kpis);
    expect(outcome.ok ? outcome.value.result.summary.kpis.recomputed : "error").toBeUndefined();
  });

  it("should backfill summary.kpis of an older result and mark them recomputed", () => {
    // Given a result written before summary.kpis existed
    const { summary, ...rest } = BenchmarkResultBuilder.legacy();
    const { kpis: written, ...olderSummary } = summary;

    // When
    const outcome = parseResultFile(
      "old.benchmark-result.v1.json",
      JSON.stringify({ ...rest, summary: olderSummary }),
    );

    // Then
    expect(outcome.ok).toBe(true);
    const kpis = outcome.ok ? outcome.value.result.summary.kpis : undefined;
    expect(kpis?.recomputed).toBe(true);
    expect(kpis?.memory).toEqual(written.memory);
    expect(kpis?.smoothness.medianFps).toBe(written.smoothness.medianFps);
  });

  it("should reject a result whose run.scenario is malformed", () => {
    // Given
    const result = BenchmarkResultBuilder.result();
    const text = JSON.stringify({
      ...result,
      run: { ...result.run, scenario: { panels: 1 } },
    });

    // When
    const outcome = parseResultFile("bad.benchmark-result.v1.json", text);

    // Then
    expect(outcome.ok).toBe(false);
  });

  it.each([
    ["broken JSON", "{", /invalid JSON/],
    ["an old/other shape", JSON.stringify({ schemaVersion: 1, run: {} }), /not a valid/],
    ["a newer schema", JSON.stringify({ schemaVersion: 2 }), /not a valid/],
  ])("rejects %s with a reason", (_name, text, reason) => {
    // Given a file that is not a valid v1 result

    // When
    const outcome = parseResultFile("bad.benchmark-result.v1.json", text);

    // Then
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? "" : outcome.reason).toMatch(reason);
  });
});

describe("parseOverheadFile", () => {
  it("accepts an overhead report and rejects other JSON", () => {
    // Given
    const report = BenchmarkResultBuilder.overhead();

    // When
    const valid = parseOverheadFile(JSON.stringify(report));
    const invalid = parseOverheadFile(JSON.stringify({ kind: "something-else" }));

    // Then
    expect(valid.ok).toBe(true);
    expect(invalid.ok).toBe(false);
  });

  it("normalizes a schema-1 overhead report to schema 3", () => {
    // Given
    const legacy = OverheadRunBuilder.legacyReport();

    // When
    const outcome = parseOverheadFile(JSON.stringify(legacy));

    // Then
    expect(outcome.ok && outcome.value).toMatchObject({
      schemaVersion: 3,
      method: "relaunch",
      cpuVerdictSource: "relaunch",
      memVerdictSource: "relaunch",
      legacy: true,
      n: 1,
      verdicts: { overall: "inconclusive" },
    });
  });
});

describe("selectRuns", () => {
  const older = BenchmarkResultBuilder.loaded({ ts: 1, finishedAtWall: "2026-01-01T00:00:00Z" });
  const newer = BenchmarkResultBuilder.loaded({ ts: 2, finishedAtWall: "2026-01-02T00:00:00Z" });
  const web = BenchmarkResultBuilder.loaded({ ts: 3, platform: "web" });
  const off = BenchmarkResultBuilder.loaded({ ts: 4, telemetryEnabled: false });

  it("keeps the latest run per scenario × platform × telemetry mode", () => {
    // Given two electron sinewave runs, one web run and one telemetry-off run

    // When
    const selected = selectRuns([older, web, off, newer], { all: false });

    // Then
    expect(selected.map((loaded) => loaded.fileName)).toEqual([
      newer.fileName,
      off.fileName,
      web.fileName,
    ]);
  });

  it("should never select overhead A/B runs, also not with --all", () => {
    // Given a scenario run and newer overhead runs of the same scenario × platform × mode
    const overheadOn = BenchmarkResultBuilder.loaded({
      ts: 5,
      mode: "overhead",
      finishedAtWall: "2026-01-03T00:00:00Z",
    });
    const overheadOff = BenchmarkResultBuilder.loaded({
      ts: 6,
      mode: "overhead",
      telemetryEnabled: false,
    });
    const results = [newer, overheadOn, overheadOff];

    // When
    const latest = selectRuns(results, { all: false });
    const all = selectRuns(results, { all: true });

    // Then
    expect(overheadOn.fileName).toContain("-overhead-");
    expect(latest.map((loaded) => loaded.fileName)).toEqual([newer.fileName]);
    expect(all.map((loaded) => loaded.fileName)).toEqual([newer.fileName]);
  });

  it("keeps every run with --all, newest first within a key", () => {
    // Given the same runs

    // When
    const selected = selectRuns([older, web, newer], { all: true });

    // Then
    expect(selected.map((loaded) => loaded.fileName)).toEqual([
      newer.fileName,
      older.fileName,
      web.fileName,
    ]);
  });
});

describe("formatRunTime", () => {
  it.each([
    ["2026-10-30T16:44:39.102Z", "2026-10-30 16:44Z"],
    ["2026-10-30T18:44:39.102+02:00", "2026-10-30 16:44Z"],
    ["not a date", "not a date"],
  ])("formats %s as %s (UTC, minutes)", (iso, expected) => {
    // Given an ISO wall-clock time

    // When
    const text = formatRunTime(iso);

    // Then
    expect(text).toBe(expected);
  });
});

describe("staleHours", () => {
  const newest = newestFinishedAtMs([
    BenchmarkResultBuilder.loaded({ finishedAtWall: "2026-10-29T10:00:00.000Z" }),
    BenchmarkResultBuilder.loaded({ finishedAtWall: "2026-10-30T16:00:00.000Z" }),
  ]);

  it("takes the newest finished time of the runs", () => {
    // Given / When / Then
    expect(newest).toBe(Date.parse("2026-10-30T16:00:00.000Z"));
    expect(newestFinishedAtMs([])).toBeUndefined();
  });

  it.each([
    ["the newest run", "2026-10-30T16:00:00.000Z", undefined],
    ["a run exactly 24 h older", "2026-10-29T16:00:00.000Z", undefined],
    ["a run 30 h older", "2026-10-29T10:00:00.000Z", 30],
  ])("flags only runs more than 24 h older: %s", (_name, finishedAtWall, expected) => {
    // Given the newest run at 2026-10-30 16:00Z

    // When
    const hours = staleHours(finishedAtWall, newest);

    // Then
    expect(hours).toBe(expected);
  });
});

describe("findOverhead", () => {
  it("returns the latest report of the scenario on the platform", () => {
    // Given
    const old = BenchmarkResultBuilder.overhead({ createdAtWall: "2026-01-01T00:00:00Z" });
    const latest = BenchmarkResultBuilder.overhead({ createdAtWall: "2026-01-03T00:00:00Z" });
    const web = BenchmarkResultBuilder.overhead({
      platform: "web",
      createdAtWall: "2026-01-09T00:00:00Z",
    });

    // When
    const found = findOverhead([old, web, latest], "sinewave", "electron");
    const missing = findOverhead([old, web, latest], "pointcloud", "electron");

    // Then
    expect(found).toBe(latest);
    expect(missing).toBeUndefined();
  });
});

describe("matchScreenshots", () => {
  it("maps a run's screenshots by file stem, ordered loaded → mid → end", () => {
    // Given
    const stem = runStem("sinewave-electron-17.benchmark-result.v1.json");
    const files = [
      "sinewave-electron-17-end.png",
      "sinewave-electron-17-loaded.png",
      "sinewave-electron-170-end.png",
      "sinewave-web-17-end.png",
      "sinewave-electron-17-end.txt",
    ];

    // When
    const shots = matchScreenshots(stem, files);

    // Then
    expect(stem).toBe("sinewave-electron-17");
    expect(shots).toEqual([
      { checkpoint: "loaded", fileName: "sinewave-electron-17-loaded.png" },
      { checkpoint: "end", fileName: "sinewave-electron-17-end.png" },
    ]);
  });
});

describe("downsample", () => {
  it("returns short series unchanged", () => {
    // Given
    const points: Point[] = [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ];

    // When / Then
    expect(downsample(points, 600)).toEqual(points);
  });

  it("caps long series at the limit and keeps the spike, the first and the last point", () => {
    // Given 10 000 flat points with one spike
    const points: Point[] = Array.from({ length: 10_000 }, (_unused, x) => ({ x, y: 1 }));
    points[4321] = { x: 4321, y: 999 };

    // When
    const result = downsample(points, 600);

    // Then
    expect(result.length).toBeLessThanOrEqual(600);
    expect(result[0]).toEqual(points[0]);
    expect(result.at(-1)).toEqual(points.at(-1));
    expect(result).toContainEqual({ x: 4321, y: 999 });
    expect(result.map((point) => point.x)).toEqual(
      [...result.map((point) => point.x)].sort((a, b) => a - b),
    );
  });
});

describe("counterRatePoints", () => {
  it("sums the series and divides each publish's increase by the elapsed seconds", () => {
    // Given two series of one counter published at 1 Hz (the second starts later)
    const samples = [
      ...TelemetryRecordBuilder.counterSeries("c", [
        [1000, 10],
        [2000, 30],
        [3000, 60],
      ]),
      ...TelemetryRecordBuilder.counterSeries("c", [[3000, 5]], { realm: "worker:1" }),
    ];

    // When
    const points = counterRatePoints(samples, identity);

    // Then
    expect(points).toEqual([
      { x: 2, y: 20 },
      { x: 3, y: 35 },
    ]);
  });

  it("returns no points without data", () => {
    // Given / When / Then
    expect(counterRatePoints([], identity)).toEqual([]);
  });
});

describe("observationMeanPoints", () => {
  it("computes the per-window mean as Δsum / Δcount", () => {
    // Given two windows: 2 renders (4 ms total), then 4 renders (20 ms total)
    const samples = TelemetryRecordBuilder.observationSeries("m", [
      [1000, 2, 4, 3],
      [2000, 4, 20, 9],
    ]);

    // When
    const points = observationMeanPoints(
      samples.filter((sample) => sample.metric === "m.count"),
      samples.filter((sample) => sample.metric === "m.sum"),
      identity,
    );

    // Then
    expect(points).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 5 },
    ]);
  });
});

describe("buildRunChartData", () => {
  it("measures x from the phases origin and adds phase markers", () => {
    // Given a run whose data source opens at 1000 ms
    const result = BenchmarkResultBuilder.result();

    // When
    const data = buildRunChartData(result);

    // Then
    expect(data.originLabel).toBe("datasource.open");
    expect(data.xMin).toBe(-1);
    expect(data.xMax).toBe(4);
    expect(data.markers).toEqual(
      expect.arrayContaining([
        { label: "layout.applied", x: -0.8, kind: "phase" },
        { label: "open", x: 0, kind: "phase" },
        { label: "first message", x: 0.2, kind: "phase" },
        { label: "panels ready", x: 0.5, kind: "phase" },
      ]),
    );
    expect(data.charts.map((chart) => chart.id)).toEqual([
      "memory",
      "heap",
      "pipeline",
      "panel-render",
      "panel-delivery",
    ]);
  });

  it("stacks memory per process type and adds a total line", () => {
    // Given
    const result = BenchmarkResultBuilder.result();

    // When
    const memory = buildRunChartData(result).charts.find((chart) => chart.id === "memory")!;

    // Then
    expect(memory.datasets.map((entry) => entry.label)).toEqual(["Browser", "Tab", "total"]);
    expect(memory.datasets.at(-1)!.data[0]).toEqual({ x: 0, y: 300 });
  });
});
