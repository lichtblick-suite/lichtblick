// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";
import {
  coverageHtml,
  exercisesCardHtml,
  filterBarHtml,
  filterTokens,
  scenarioChipsHtml,
  scenarioCoverage,
} from "./htmlReportExercises";
import type { ExercisedRun } from "./htmlReportExercises.types";
import { RunInfoBuilder } from "../result/builders/RunInfoBuilder";
import { exercisedComponents } from "../result/exercised";
import type { PersistedResultV1 } from "../result/schemaV1";

function exercisedRun(result: PersistedResultV1, index = 0): ExercisedRun {
  return { index, result, exercised: exercisedComponents(result) };
}

/** The builder's result (telemetry of panel `3D!a`) declaring `scenario`. */
function withScenario(
  overrides: Parameters<typeof RunInfoBuilder.scenario>[1],
  scenarioId = "sinewave",
): PersistedResultV1 {
  const result = BenchmarkResultBuilder.result({ scenarioId });
  return {
    ...result,
    run: { ...result.run, scenario: RunInfoBuilder.scenario(scenarioId, overrides) },
  };
}

describe("filterTokens / scenarioChipsHtml", () => {
  it("should derive group and tag tokens and render clickable chips with panel counts", () => {
    // Given a scenario declaring two 3D panels
    const result = withScenario({
      group: "3d-rendering",
      tags: ["3d", "pointcloud"],
      player: "PointcloudPlayer",
      panels: [
        { id: "3D!a", type: "3D" },
        { id: "3D!b", type: "3D" },
      ],
    });

    // When
    const tokens = filterTokens(result);
    const html = scenarioChipsHtml(result, exercisedComponents(result));

    // Then
    expect(tokens).toEqual(["group:3d-rendering", "tag:3d", "tag:pointcloud"]);
    expect(html).toContain('data-filter="group:3d-rendering"');
    expect(html).toContain('data-filter="tag:pointcloud"');
    expect(html).toContain(">3D ×2<");
    expect(html).toContain(">PointcloudPlayer<");
  });

  it("should show observed panel types for results without a scenario", () => {
    // Given
    const legacy = BenchmarkResultBuilder.legacy();

    // When
    const html = scenarioChipsHtml(legacy, exercisedComponents(legacy));

    // Then
    expect(filterTokens(legacy)).toEqual([]);
    expect(html).toContain(">scenario not recorded<");
    expect(html).toContain(">3D ×1<");
    expect(html).not.toContain("data-filter");
  });

  it("should escape hostile scenario fields", () => {
    // Given
    const result = withScenario({ tags: ['"><script>x</script>'], player: "<b>p</b>" });

    // When
    const html = scenarioChipsHtml(result, exercisedComponents(result)) + filterBarHtml([result]);

    // Then
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>p</b>");
    expect(html).toContain("&lt;b&gt;p&lt;/b&gt;");
  });
});

describe("filterBarHtml", () => {
  it("should list every group and tag once after an 'all' chip", () => {
    // Given
    const results = [
      BenchmarkResultBuilder.result(),
      BenchmarkResultBuilder.result({ platform: "web" }),
    ];

    // When
    const html = filterBarHtml(results);

    // Then
    expect(html).toContain('data-filter="">all</button>');
    expect(html.match(/data-filter="group:time-series"/g)).toHaveLength(1);
    expect(html.match(/data-filter="tag:/g)).toHaveLength(2);
  });

  it("should render nothing without scenarios", () => {
    // Given / When / Then
    expect(filterBarHtml([BenchmarkResultBuilder.legacy()])).toBe("");
  });
});

describe("exercisesCardHtml", () => {
  it("should show the declared scenario next to its observed telemetry", () => {
    // Given sinewave declaring Plot!a, while only 3D!a emitted panel telemetry
    const result = withScenario({ params: { rate: "60", url: "<redacted>" } });

    // When
    const html = exercisesCardHtml(result, exercisedComponents(result));

    // Then
    expect(html).toContain("<h3>Exercises</h3>");
    expect(html).toContain("One Plot panel charting a synthetic sine wave signal.");
    expect(html).toContain("<td>Synthetic (sinewave)</td>");
    expect(html).toContain("<td>SinewavePlayer</td>");
    expect(html).toContain("<td>rate</td><td>60</td>");
    expect(html).toContain("&lt;redacted&gt;");
    expect(html).toMatch(/<td class="warn"[^>]*>⚠ no telemetry<\/td>/);
    expect(html).toContain("<td>3D!a</td><td>3D</td><td>—</td><td>observed only</td>");
    expect(html).toContain(">MessagePipeline<");
  });

  it("should show only the observed side for results without a scenario", () => {
    // Given
    const legacy = BenchmarkResultBuilder.legacy();

    // When
    const html = exercisesCardHtml(legacy, exercisedComponents(legacy));

    // Then
    expect(html).toContain("scenario not recorded (older result)");
    expect(html).toContain("Observed panel types");
    expect(html).not.toContain("Params");
  });
});

describe("scenarioCoverage / coverageHtml", () => {
  it("should merge runs per scenario and prefer observed over declared", () => {
    // Given an electron run and a web run of sinewave (Plot declared, 3D observed)
    const runs = [
      exercisedRun(BenchmarkResultBuilder.result(), 0),
      exercisedRun(BenchmarkResultBuilder.result({ platform: "web" }), 1),
    ];

    // When
    const [coverage] = scenarioCoverage(runs);

    // Then
    expect(coverage!.scenarioId).toBe("sinewave");
    expect(coverage!.cells.get("panel:Plot")).toBe("declared");
    expect(coverage!.cells.get("panel:3D")).toBe("observed");
    expect(coverage!.cells.get("player:SinewavePlayer")).toBe("observed");
    expect(coverage!.cells.get("component:MessagePipeline")).toBe("observed");
  });

  it("should render the matrix with grouped columns and a legend", () => {
    // Given
    const runs = [
      exercisedRun(BenchmarkResultBuilder.result(), 0),
      exercisedRun(BenchmarkResultBuilder.legacy({ scenarioId: "old" }), 1),
    ];

    // When
    const html = coverageHtml(runs);

    // Then
    expect(html).toContain('<th colspan="2">Panel types</th>');
    expect(html).toContain('<th colspan="1">Players</th>');
    expect(html).toContain("Pipeline components</th>");
    expect(html).toContain(
      '<td class="cov cov-declared" title="declared by the scenario only (no telemetry)">○</td>',
    );
    expect(html).toContain('<td class="cov cov-observed" title="observed in telemetry">✓</td>');
    expect(html).toContain('<tr data-tags=""><td>old</td>');
    expect(html).toContain("✓ observed in telemetry · ○ declared by the scenario only");
  });

  it("should say so without runs", () => {
    // Given / When / Then
    expect(coverageHtml([])).toContain("No runs.");
  });
});
