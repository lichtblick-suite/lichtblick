// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LAYOUTS } from "../layouts";
import { getScenario } from "./registry";
import {
  buildScenarioDescriptor,
  describeLayoutPanels,
  redactScenarioParams,
} from "./scenarioDescriptor";
import { Scenario } from "./types";

function buildScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "scenario-id",
    description: "A scenario.",
    group: "time-series",
    tags: ["plot", "synthetic"],
    player: "SinewavePlayer",
    layout: "sinewave",
    dataSource: { factoryId: "sinewave" },
    pipeline: "synthetic",
    ...overrides,
  };
}

describe("redactScenarioParams", () => {
  it("should redact URL-like values and secret-named params, keeping the keys", () => {
    // Given
    const params = {
      url: "relative/file.mcap",
      fixtures: "https://example.com/a.mcap,https://example.com/b.mcap",
      local: "blob:http://localhost/123",
      Token: "abc",
      apiKey: "kept",
      maxHydratedSources: "1",
    };

    // When
    const redacted = redactScenarioParams(params);

    // Then
    expect(redacted).toEqual({
      url: "<redacted>",
      fixtures: "<redacted>",
      local: "<redacted>",
      Token: "<redacted>",
      apiKey: "kept",
      maxHydratedSources: "1",
    });
  });

  it("should match URL schemes case-insensitively and after leading whitespace", () => {
    // Given
    const params = { a: "  HTTP://host/x", b: "Data:text/plain,hi", c: "httpish" };

    // When
    const redacted = redactScenarioParams(params);

    // Then
    expect(redacted).toEqual({ a: "<redacted>", b: "<redacted>", c: "httpish" });
  });

  it("should return an empty object without params", () => {
    // Given / When / Then
    expect(redactScenarioParams(undefined)).toEqual({});
  });
});

describe("describeLayoutPanels", () => {
  it("should list panels in layout order with type and optional title", () => {
    // Given
    const configById = {
      "RawMessages!multi": { topicPath: "/x" },
      "Plot!multi": { title: "/benchmark/multi.value" },
      "3D!a": { foxglovePanelTitle: "Front camera" },
      "Tab!t": { title: "   " },
      NoSeparator: {},
    };

    // When
    const panels = describeLayoutPanels(configById);

    // Then
    expect(panels).toEqual([
      { id: "RawMessages!multi", type: "RawMessages" },
      { id: "Plot!multi", type: "Plot", title: "/benchmark/multi.value" },
      { id: "3D!a", type: "3D", title: "Front camera" },
      { id: "Tab!t", type: "Tab" },
      { id: "NoSeparator", type: "NoSeparator" },
    ]);
  });

  it("should return no panels without a layout", () => {
    // Given / When / Then
    expect(describeLayoutPanels(undefined)).toEqual([]);
  });
});

describe("buildScenarioDescriptor", () => {
  it("should describe a synthetic scenario with its layout panels", () => {
    // Given
    const scenario = getScenario("sinewave")!;

    // When
    const descriptor = buildScenarioDescriptor({
      scenario,
      params: scenario.dataSource.params,
      layout: LAYOUTS[scenario.layout],
    });

    // Then
    expect(descriptor).toEqual({
      scenarioId: "sinewave",
      description: scenario.description,
      group: "time-series",
      tags: ["plot", "synthetic"],
      layout: "sinewave",
      dataSource: { factoryId: "sinewave", displayName: "Synthetic" },
      player: "SinewavePlayer",
      params: {},
      panels: [{ id: "Plot!a", type: "Plot", title: "10 second window" }],
    });
  });

  it("should redact fixture URLs of the effective params and keep durationMs", () => {
    // Given
    const scenario = getScenario("mcap-ingest")!;
    const params = { url: "http://127.0.0.1:1/a.mcap" };

    // When
    const descriptor = buildScenarioDescriptor({
      scenario,
      params,
      layout: LAYOUTS[scenario.layout],
    });

    // Then
    expect(descriptor.params).toEqual({ url: "<redacted>" });
    expect(descriptor.durationMs).toBe(5_000);
    expect(descriptor.group).toBe("real-pipeline-ingest");
    expect(descriptor.player).toBe("IterablePlayer + McapIterableSource (main thread)");
    expect(descriptor.panels).toEqual([]);
  });

  it("should report the effective (overridden) durationMs", () => {
    // Given
    const scenario = getScenario("mcap-ingest")!;

    // When
    const descriptor = buildScenarioDescriptor({
      scenario,
      params: undefined,
      layout: undefined,
      durationMs: 30_000,
    });

    // Then
    expect(descriptor.durationMs).toBe(30_000);
  });

  it("should omit optional fields the scenario does not define", () => {
    // Given
    const scenario = buildScenario({ layout: "missing-layout" });

    // When
    const descriptor = buildScenarioDescriptor({ scenario, params: undefined, layout: undefined });

    // Then
    expect(descriptor.dataSource).toEqual({ factoryId: "sinewave" });
    expect(descriptor).not.toHaveProperty("durationMs");
    expect(descriptor.panels).toEqual([]);
    expect(descriptor.params).toEqual({});
  });

  it("should produce plain JSON (survives a serialization round trip unchanged)", () => {
    // Given
    const scenario = getScenario("transformpreloading")!;

    // When
    const descriptor = buildScenarioDescriptor({
      scenario,
      params: undefined,
      layout: LAYOUTS[scenario.layout],
    });

    // Then
    const serialized = JSON.stringify(descriptor) ?? "";
    expect(JSON.parse(serialized)).toEqual(descriptor);
    expect(descriptor.panels).toEqual([
      { id: "RawMessages!41teyny", type: "RawMessages" },
      { id: "3D!2cny167", type: "3D" },
    ]);
  });
});
