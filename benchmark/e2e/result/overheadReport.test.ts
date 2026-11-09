// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CpuProfileBuilder } from "./builders/CpuProfileBuilder";
import { normalizeOverheadReport } from "./overheadReport";
import { OverheadRunBuilder } from "../runner/builders/OverheadRunBuilder";
import { ToggleBlockBuilder } from "../runner/builders/ToggleBlockBuilder";
import { buildOverheadReport } from "../runner/overhead";

/** A current (schema-3) relaunch report, as written to disk. */
function relaunchReportJson(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(
      buildOverheadReport({
        platform: "web",
        scenarioId: "sinewave",
        runs: OverheadRunBuilder.abba([{}, {}, {}]),
        config: OverheadRunBuilder.config(),
      }),
    ),
  ) as Record<string, unknown>;
}

/** A current (schema-3) toggle-method report, as written to disk. */
function toggleReportJson(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(
      buildOverheadReport({
        platform: "electron",
        scenarioId: "sinewave",
        runs: [],
        config: OverheadRunBuilder.config({ repeats: 0 }),
        method: "toggle",
        toggle: ToggleBlockBuilder.summary(),
      }),
    ),
  ) as Record<string, unknown>;
}

/** A complete toggle section as written to disk, with `patch` applied on top. */
function toggleSectionJson(patch: Record<string, unknown>): Record<string, unknown> {
  const section = JSON.parse(JSON.stringify(ToggleBlockBuilder.summary())) as Record<
    string,
    unknown
  >;
  return { ...section, ...patch };
}

/** Toggle sections that pass a bare `metrics` / `blocks` / `quartets` check but cannot render. */
const MALFORMED_TOGGLE_SECTIONS: [string, Record<string, unknown>][] = [
  ["only metrics, blocks and quartets", { metrics: {}, blocks: [], quartets: [] }],
  ["no config", toggleSectionJson({ config: undefined })],
  ["a config without block length", toggleSectionJson({ config: { quartets: 10 } })],
  ["no toggle latency", toggleSectionJson({ toggleLatencyMsMax: undefined })],
  ["no UA call counts", toggleSectionJson({ uaCalls: undefined })],
  ["no renderer record counts", toggleSectionJson({ rendererRecords: { onBlocks: 5 } })],
  ["no relative CPU statistics", toggleSectionJson({ metrics: { cpuPctPoints: { n: 0 } } })],
  [
    "a non-numeric CI bound",
    toggleSectionJson({
      metrics: {
        cpuRelative: { n: 6, median: 0.01, ci95: { lower: "0", upper: 0.02 } },
        cpuPctPoints: { n: 6 },
      },
    }),
  ],
  ["an unknown verdict", toggleSectionJson({ verdict: "passed" })],
  ["a quartet without block indices", toggleSectionJson({ quartets: [{ excluded: false }] })],
  ["a block that is not an object", toggleSectionJson({ blocks: [42] })],
];

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

  it.each([1, 2, 4])("should skip a report of unsupported schema version %d", (schemaVersion) => {
    // Given an otherwise complete report with another schema version
    const json = { ...relaunchReportJson(), schemaVersion };

    // When
    const report = normalizeOverheadReport(json);

    // Then
    expect(report).toBeUndefined();
  });

  it("should skip a schema-3 report with a toggle section from before the quartets", () => {
    // Given a both-method report whose toggle section has adjacent pairs instead of quartets
    const v3 = buildOverheadReport({
      platform: "web",
      scenarioId: "sinewave",
      runs: OverheadRunBuilder.abba([{}, {}, {}]),
      config: OverheadRunBuilder.config(),
      method: "both",
      toggle: ToggleBlockBuilder.summary(),
    });
    const json = {
      ...v3,
      toggle: ToggleBlockBuilder.preQuartetSection(v3.toggle!),
    };

    // When
    const report = normalizeOverheadReport(JSON.parse(JSON.stringify(json)));

    // Then
    expect(report).toBeUndefined();
  });

  it.each([
    ["not an object", 42],
    ["another kind", { ...relaunchReportJson(), kind: "result" }],
    ["a report without pairs", { ...relaunchReportJson(), pairs: undefined }],
    [
      "a report with an incomplete toggle section",
      {
        ...relaunchReportJson(),
        method: "toggle",
        cpuVerdictSource: "toggle",
        memVerdictSource: "notMeasured",
        toggle: { n: 5 },
      },
    ],
    [
      "a report without verdict sources",
      {
        ...relaunchReportJson(),
        cpuVerdictSource: undefined,
        memVerdictSource: undefined,
      },
    ],
    ["a report without config arms", { ...relaunchReportJson(), config: { repeats: 3 } }],
    [
      "a report with an unknown CPU verdict",
      {
        ...relaunchReportJson(),
        verdicts: { cpu: "passed", memory: "within", overall: "within" },
      },
    ],
    [
      "a report with an unknown memory verdict",
      {
        ...relaunchReportJson(),
        verdicts: { cpu: "within", memory: "ok", overall: "within" },
      },
    ],
    [
      "a report with an unknown relaunch verdict",
      {
        ...relaunchReportJson(),
        relaunchVerdicts: { cpu: "within", memory: "within", overall: "fine" },
      },
    ],
  ])("should reject %s", (_label, json) => {
    // Given / When / Then
    expect(normalizeOverheadReport(json)).toBeUndefined();
  });
  it.each(
    MALFORMED_TOGGLE_SECTIONS,
  )("should reject a report whose toggle section has %s", (_label, toggle) => {
    // Given a toggle-method report with a malformed main toggle section
    const json = { ...toggleReportJson(), toggle };

    // When
    const report = normalizeOverheadReport(json);

    // Then
    expect(report).toBeUndefined();
  });

  it.each(
    MALFORMED_TOGGLE_SECTIONS,
  )("should drop a frame-probe toggle section with %s", (_label, toggleFrameProbe) => {
    // Given a valid toggle-method report with a malformed frame-probe section
    const valid = toggleReportJson();

    // When
    const report = normalizeOverheadReport({ ...valid, toggleFrameProbe });

    // Then
    expect(report).toEqual(valid);
  });

  it("should drop a toggle section without the UA probe that has no verdict", () => {
    // Given a valid toggle-method report whose section without the UA probe has no verdict
    const valid = toggleReportJson();
    const toggleWithoutUaProbe = toggleSectionJson({ verdict: undefined });

    // When
    const report = normalizeOverheadReport({ ...valid, toggleWithoutUaProbe });

    // Then
    expect(report).toEqual(valid);
  });

  it.each([
    ["config arms that are not strings", { config: { repeats: 3, warmupRuns: 1, arms: [1, 2] } }],
    ["a config without warm-up runs", { config: { repeats: 3, arms: ["off", "on"] } }],
    ["no targets", { targets: { cpuDeltaRelativeMax: 0.02 } }],
    ["relaunch metrics without fps", { metrics: { cpuRelative: { n: 0 } } }],
    ["a run without steady window", { runs: [{ repeat: 0, arm: "on" }] }],
    ["a self-cost without rates", { selfCost: { n: 3 } }],
    ["a UA cost without metrics", { uaCost: { n: 3, excludedPairs: 0, processSetMismatches: 0 } }],
  ])("should reject a report with %s", (_label, patch) => {
    // Given an otherwise valid relaunch report with a malformed field the renderers dereference
    const json = { ...relaunchReportJson(), ...patch };

    // When
    const report = normalizeOverheadReport(json);

    // Then
    expect(report).toBeUndefined();
  });
});
