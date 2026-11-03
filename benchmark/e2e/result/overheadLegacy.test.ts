// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CpuProfileBuilder } from "./builders/CpuProfileBuilder";
import {
  normalizeLegacyOverheadReport,
  normalizeOverheadReport,
  normalizeV2OverheadReport,
} from "./overheadLegacy";
import { OverheadRunBuilder } from "../runner/builders/OverheadRunBuilder";
import { ToggleBlockBuilder } from "../runner/builders/ToggleBlockBuilder";
import { buildOverheadReport } from "../runner/overhead";

const MIB = 1024 * 1024;

describe("normalizeLegacyOverheadReport", () => {
  it("should map a schema-1 report to schema 2 with one inconclusive pair", () => {
    // Given
    const legacy = OverheadRunBuilder.legacyReport({
      deltas: { cpuDeltaPctPoints: 1, cpuDeltaRelative: 0.01, memDeltaBytes: 3 * MIB },
    });

    // When
    const report = normalizeLegacyOverheadReport(legacy);

    // Then
    expect(report).toMatchObject({
      schemaVersion: 2,
      legacy: true,
      n: 1,
      excludedPairs: 0,
      verdicts: { cpu: "inconclusive", memory: "inconclusive", overall: "inconclusive" },
      targets: legacy.targets,
    });
    expect(report.metrics.cpuRelative).toEqual({
      n: 1,
      median: 0.01,
      iqr: 0,
      ci95: { lower: 0.01, upper: 0.01 },
    });
    expect(report.metrics.memBytes.median).toBe(3 * MIB);
    expect(report.metrics.fps).toEqual({ n: 0 });
    expect(report.runs.map((run) => run.arm)).toEqual(["off", "on"]);
    expect(report.runs[1]!.steady.medianTotalCpuPercent).toBe(101);
  });

  it("should leave the relative CPU empty when the legacy report had none", () => {
    // Given
    const legacy = OverheadRunBuilder.legacyReport({
      deltas: { cpuDeltaPctPoints: 2, memDeltaBytes: 0 },
    });

    // When
    const report = normalizeLegacyOverheadReport(legacy);

    // Then
    expect(report.metrics.cpuRelative).toEqual({ n: 0 });
    expect(report.pairs[0]!.deltas).not.toHaveProperty("cpuRelative");
  });
});

describe("normalizeV2OverheadReport", () => {
  it("should map a schema-2 report to a schema-3 relaunch report with both verdicts from it", () => {
    // Given
    const v2 = OverheadRunBuilder.reportV2();

    // When
    const report = normalizeV2OverheadReport(v2);

    // Then
    expect(report).toMatchObject({
      schemaVersion: 3,
      method: "relaunch",
      config: { ...v2.config, method: "relaunch" },
      cpuVerdictSource: "relaunch",
      memVerdictSource: "relaunch",
      verdicts: v2.verdicts,
      relaunchVerdicts: v2.verdicts,
      n: v2.n,
      metrics: v2.metrics,
    });
    expect(report.toggle).toBeUndefined();
  });
});

describe("normalizeOverheadReport", () => {
  it("should pass schema-3 reports through", () => {
    // Given a both-method report with a toggle section
    const v3 = buildOverheadReport({
      platform: "web",
      scenarioId: "sinewave",
      runs: OverheadRunBuilder.abba([{}, {}, {}]),
      config: OverheadRunBuilder.config(),
      method: "both",
      toggle: ToggleBlockBuilder.summary(),
    });

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(v3)));

    // Then
    expect(report).toEqual(v3);
  });

  it("should keep a toggle section without the UA probe", () => {
    // Given a toggle-method report with both toggle sections
    const v3 = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle: ToggleBlockBuilder.summary(),
      toggleWithoutUaProbe: ToggleBlockBuilder.summary(),
    });

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(v3)));

    // Then
    expect(report).toEqual(v3);
  });

  it("should keep a frame-probe toggle section and drop an incomplete one", () => {
    // Given a toggle-method report with a frame-probe section, and the same with a malformed one
    const base = {
      platform: "electron" as const,
      scenarioId: "mcap-multi-ingest",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle" as const,
      toggle: ToggleBlockBuilder.summary(),
    };
    const withProbe = buildOverheadReport({
      ...base,
      toggleFrameProbe: ToggleBlockBuilder.summary(),
    });
    const withoutProbe = buildOverheadReport(base);
    const malformed = { ...withoutProbe, toggleFrameProbe: { blocks: [] } };

    // When
    const kept = normalizeOverheadReport(JSON.parse(JSON.stringify(withProbe)));
    const dropped = normalizeOverheadReport(JSON.parse(JSON.stringify(malformed)));

    // Then
    expect(kept).toEqual(withProbe);
    expect(dropped).toEqual(withoutProbe);
  });

  it("should drop an incomplete toggle section without the UA probe", () => {
    // Given a toggle-method report whose section without the UA probe has no quartets
    const v3 = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle: ToggleBlockBuilder.summary(),
    });
    const json = { ...v3, toggleWithoutUaProbe: { blocks: [] } };

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(json)));

    // Then
    expect(report).toEqual(v3);
  });

  it.each([
    { status: "measured", section: CpuProfileBuilder.measured() },
    { status: "unsupported", section: CpuProfileBuilder.unsupported() },
  ])("should keep a $status direct attribution", ({ section }) => {
    // Given
    const v3 = buildOverheadReport({
      platform: "electron",
      scenarioId: "sinewave",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle: ToggleBlockBuilder.summary(),
      directAttribution: section,
    });

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(v3)));

    // Then
    expect(report).toEqual(v3);
  });

  it("should drop an incomplete direct attribution", () => {
    // Given a measured section without its rates
    const v3 = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle: ToggleBlockBuilder.summary(),
    });
    const json = { ...v3, directAttribution: { status: "measured", config: {} } };

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(json)));

    // Then
    expect(report).toEqual(v3);
  });

  it("should re-summarize a toggle section from before the quartets from its blocks", () => {
    // Given a both-method report (toggle +5 %, exceeds) written with pair statistics and verdicts
    const v3 = buildOverheadReport({
      platform: "web",
      scenarioId: "sinewave",
      runs: OverheadRunBuilder.abba([{}, {}, {}]),
      config: OverheadRunBuilder.config(),
      method: "both",
      toggle: ToggleBlockBuilder.summary(Array.from({ length: 6 }, () => ({ off: 100, on: 105 }))),
    });
    const { toggle: _toggle, ...config } = v3.config;
    const json = {
      ...v3,
      config,
      verdicts: { ...v3.verdicts, cpu: "within", overall: "within" },
      toggle: ToggleBlockBuilder.preQuartetSection(v3.toggle!),
    };

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(json)));

    // Then: quartets, statistics and the CPU / overall verdicts as written today
    expect(report).toEqual(v3);
  });

  it("should normalize schema-2 reports to method relaunch", () => {
    // Given
    const v2 = OverheadRunBuilder.reportV2();

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(v2)));

    // Then
    expect(report).toEqual(normalizeV2OverheadReport(v2));
  });

  it("should normalize schema-1 reports through schema 2", () => {
    // Given / When
    const report = normalizeOverheadReport(OverheadRunBuilder.legacyReport());

    // Then
    expect(report).toMatchObject({
      schemaVersion: 3,
      legacy: true,
      method: "relaunch",
      cpuVerdictSource: "relaunch",
      memVerdictSource: "relaunch",
      verdicts: { overall: "inconclusive" },
    });
  });

  it.each([
    ["not an object", 42],
    ["another kind", { kind: "result", schemaVersion: 2, scenarioId: "x" }],
    ["an unknown schema", { ...OverheadRunBuilder.legacyReport(), schemaVersion: 4 }],
    ["a schema-2 report without pairs", { kind: "overhead", schemaVersion: 2, scenarioId: "x" }],
    [
      "a schema-3 report with an incomplete toggle section",
      {
        ...OverheadRunBuilder.reportV2(),
        schemaVersion: 3,
        method: "toggle",
        cpuVerdictSource: "toggle",
        memVerdictSource: "notMeasured",
        toggle: { n: 5 },
      },
    ],
    [
      "a schema-3 report without verdict sources",
      { ...OverheadRunBuilder.reportV2(), schemaVersion: 3, method: "relaunch" },
    ],
  ])("should reject %s", (_label, json) => {
    // Given / When / Then
    expect(normalizeOverheadReport(json)).toBeUndefined();
  });
});
