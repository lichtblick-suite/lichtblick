// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  buildOverheadTable,
  buildPanelsSection,
  buildPanelsTable,
  buildPipelineLine,
  buildResultsTable,
  latestResults,
} from "./summaryMarkdown";
import { BenchmarkResultV1, buildResultV1 } from "../result/schemaV1";
import { buildOverheadReport } from "../runner/overhead";

const MIB = 1024 * 1024;

function makeResult(
  overrides: {
    scenarioId?: string;
    platform?: "web" | "electron";
    finishedAtWall?: string;
    withPool?: boolean;
  } = {},
): BenchmarkResultV1 {
  const labels = { poolId: "pool-1" };
  const pool = (metric: string, value: number) => ({
    kind: "sample" as const,
    realm: "worker:1",
    sequence: 0,
    monotonicTs: 1000,
    metric: `pipeline.hydratedSourcePool.${metric}`,
    value,
    unit: "count" as const,
    scope: "pipeline" as const,
    metricType: "counter" as const,
    labels,
  });
  return buildResultV1({
    run: {
      scenarioId: overrides.scenarioId ?? "sinewave",
      pipeline: "synthetic",
      platform: overrides.platform ?? "web",
      telemetryEnabled: true,
      startedAtWall: "2026-01-01T00:00:00.000Z",
      finishedAtWall: overrides.finishedAtWall ?? "2026-01-01T00:00:05.000Z",
      startMonotonicTs: 0,
      endMonotonicTs: 5000,
      sampleIntervalMs: 1000,
      environment: { os: "linux", arch: "x64", ci: true, cpuModel: "cpu", totalMemBytes: 1 },
    },
    pageRecords:
      overrides.withPool === true
        ? [
            pool("acquires", 3),
            pool("releases", 3),
            pool("activePins", 0),
            pool("overBudgetPeriods", 2),
            { ...pool("overBudgetDurationMs", 1500), unit: "ms" },
          ]
        : [],
    drainedDropped: 0,
    drainRealm: "renderer",
    hostSamples: [
      {
        monotonicTs: 1000,
        pid: 1,
        processType: "browser",
        workingSetBytes: 100 * MIB,
        cpuPercent: 12.5,
      },
    ],
    listenerDispatchSamples: [
      { monotonicTs: 1000, value: 1 },
      { monotonicTs: 1001, value: 3 },
    ],
  });
}

describe("latestResults", () => {
  it("keeps the latest run per scenario and platform", () => {
    // Given two web sinewave runs and one electron run
    const older = makeResult({ finishedAtWall: "2026-01-01T00:00:01.000Z" });
    const newer = makeResult({ finishedAtWall: "2026-01-02T00:00:01.000Z" });
    const electron = makeResult({ platform: "electron" });

    // When
    const latest = latestResults([older, electron, newer]);

    // Then
    expect(latest).toEqual([electron, newer]);
  });
});

describe("buildResultsTable", () => {
  it("renders one row per run with pool columns", () => {
    // Given
    const results = [makeResult({ scenarioId: "mcap-multi-ingest", withPool: true }), makeResult()];

    // When
    const markdown = buildResultsTable(results);

    // Then
    const rows = markdown.trim().split("\n");
    expect(rows).toHaveLength(4);
    expect(rows[2]).toBe(
      "| mcap-multi-ingest | web | on | 100.0 MiB | 12.5 % | — | 1.00 / 3.00 ms | — | — | ✅ | 2 / 1500 ms |",
    );
    expect(rows[3]).toContain("| sinewave | web | on |");
    expect(rows[3]).toContain("| — | — |");
  });

  it("reports when there are no results", () => {
    // Given / When / Then
    expect(buildResultsTable([])).toContain("No benchmark-result.v1 files found.");
  });
});

function withSummary(
  result: BenchmarkResultV1,
  summary: Partial<BenchmarkResultV1["summary"]>,
): BenchmarkResultV1 {
  return { ...result, summary: { ...result.summary, ...summary } };
}

describe("buildPipelineLine", () => {
  it("renders rates, fanout, cache and remote figures", () => {
    // Given
    const result = withSummary(makeResult(), {
      pipeline: {
        messagesReceived: 6000,
        messagesPerSec: 1234.4,
        bytesPerSec: 2.5 * MIB,
        deliveredFanout: 2,
        blockCachePeakBytes: 64 * MIB,
        sourceCacheHitRatio: 0.75,
        remoteBytesRead: 10 * MIB,
      },
    });

    // When
    const line = buildPipelineLine(result);

    // Then
    expect(line).toBe(
      "Pipeline: 1234 msg/s · 2.50 MiB/s · fanout 2.00 · block cache peak 64.0 MiB · " +
        "source cache hit ratio 75.0 % · remote read 10.0 MiB",
    );
  });

  it("renders dashes for missing pipeline figures", () => {
    // Given / When / Then
    expect(
      buildPipelineLine(withSummary(makeResult(), { pipeline: { messagesReceived: 0 } })),
    ).toBe(
      "Pipeline: — msg/s · — MiB/s · fanout — · block cache peak — · source cache hit ratio — · remote read —",
    );
    expect(buildPipelineLine(makeResult())).toBe("Pipeline: —");
  });
});

describe("buildPanelsTable", () => {
  it("renders one row per panel with dashes for React panels' render stats", () => {
    // Given an adapter panel (3D) and a React panel (Plot)
    const result = withSummary(makeResult(), {
      panels: {
        "3D!a": {
          panelType: "3D",
          mountedAtMs: 100,
          firstRenderMs: 1234.4,
          mounts: 1,
          messages: 120,
          messageBytes: 2048,
          rangeMessages: 0,
          rangeBytes: 0,
          renders: 30,
          renderMeanMs: 4,
          renderMaxMs: 8.25,
          renderP90WindowMaxMs: 8,
          skipped: 1,
        },
        "Plot!a": {
          panelType: "Plot",
          mountedAtMs: 90,
          mounts: 1,
          messages: 600,
          messageBytes: 0,
          rangeMessages: 5000,
          rangeBytes: 3 * MIB,
        },
      },
    });

    // When
    const table = buildPanelsTable(result);

    // Then
    expect(table.split("\n")).toEqual([
      "| Panel | Type | Messages | Bytes | Range msgs | Render mean / max | First render |",
      "|-------|------|----------|-------|------------|-------------------|--------------|",
      "| 3D!a | 3D | 120 | 2.0 KiB | 0 | 4.00 / 8.25 ms (30) | 1234 ms |",
      "| Plot!a | Plot | 600 | 0 B | 5000 | — | — |",
    ]);
  });

  it("reports missing panel telemetry", () => {
    // Given / When / Then
    expect(buildPanelsTable(makeResult())).toBe("No panel telemetry.");
  });
});

describe("buildPanelsSection", () => {
  it("renders the latest telemetry-on run per scenario with panels-ready coverage", () => {
    // Given a telemetry-on run and a telemetry-off run of the same scenario
    const on = withSummary(makeResult({ scenarioId: "pointcloud" }), {
      phases: {
        origin: "app.ready",
        panelsReadyMs: 1500,
        panelsReadyCoverage: { mounted: 2, firstRendered: 1 },
      },
      pipeline: { messagesReceived: 10, messagesPerSec: 10 },
    });
    const off = makeResult({
      scenarioId: "pointcloud",
      finishedAtWall: "2026-01-03T00:00:00.000Z",
    });
    const offRun = { ...off, run: { ...off.run, telemetryEnabled: false } };

    // When
    const section = buildPanelsSection([on, offRun]);

    // Then
    expect(section).toBe(
      [
        "",
        "### pointcloud (web)",
        "",
        "Pipeline: 10 msg/s · — MiB/s · fanout — · block cache peak — · source cache hit ratio — · remote read —",
        "",
        "Panels ready: 1500 ms after app.ready (firstRender from 1 of 2 mounted panels)",
        "",
        "No panel telemetry.",
        "",
      ].join("\n"),
    );
  });

  it("reports when there is no telemetry-on run", () => {
    // Given
    const off = makeResult();
    const offRun = { ...off, run: { ...off.run, telemetryEnabled: false } };

    // When / Then
    expect(buildPanelsSection([offRun])).toBe(
      "\nNo benchmark-result.v1 files with telemetry found.\n",
    );
    expect(buildPanelsSection([])).toBe("\nNo benchmark-result.v1 files with telemetry found.\n");
  });
});

describe("buildOverheadTable", () => {
  it("renders deltas and the report-only note", () => {
    // Given
    const off = makeResult();
    const on = makeResult();
    const report = buildOverheadReport({
      platform: "web",
      scenarioId: "sinewave",
      off: { ...off, run: { ...off.run, telemetryEnabled: false } },
      on,
    });

    // When
    const markdown = buildOverheadTable([report]);

    // Then
    expect(markdown).toContain("Report only");
    expect(markdown).toContain(
      "| web | sinewave | 12.5 % | 12.5 % | +0.0 pp / 0.0 % | 100.0 MiB | 100.0 MiB | +0.0 MiB | ✅ (CPU ≤ 2 %, mem ≤ 20.0 MiB) |",
    );
  });

  it("reports when there are no overhead reports", () => {
    // Given / When / Then
    expect(buildOverheadTable([])).toContain("No overhead reports found.");
  });
});
