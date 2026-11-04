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
  ])("should reject %s", (_label, json) => {
    // Given / When / Then
    expect(normalizeOverheadReport(json)).toBeUndefined();
  });
});
