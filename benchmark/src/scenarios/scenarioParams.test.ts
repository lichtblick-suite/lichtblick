// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  getDataSourceParamOverrides,
  resolveScenarioDataSourceParams,
  resolveScenarioDurationMs,
} from "./scenarioParams";
import { Scenario } from "./types";

function buildScenario(dataSource: Scenario["dataSource"]): Scenario {
  return {
    id: "scenario-id",
    description: "A scenario.",
    group: "real-pipeline-ingest",
    tags: ["real-pipeline", "mcap"],
    player: "IterablePlayer + McapIterableSource (main thread)",
    layout: "empty",
    dataSource,
    pipeline: "real",
  };
}

describe("getDataSourceParamOverrides", () => {
  it("should collect ds.<param> values and ignore unrelated, empty or nameless params", () => {
    // Given
    const url = new URL(
      "http://localhost/?scenario=x&ds=ignored&ds.url=http://a/1.mcap&ds.maxHydratedSources=2&ds.empty=&ds.=v",
    );

    // When
    const overrides = getDataSourceParamOverrides(url);

    // Then
    expect(overrides).toEqual({ url: "http://a/1.mcap", maxHydratedSources: "2" });
  });

  it("should join a repeated ds.url with commas and keep the last value of other repeated params", () => {
    // Given
    const url = new URL(
      "http://localhost/?ds.url=http://a/1.mcap&ds.url=http://a/2.mcap&ds.maxHydratedSources=1&ds.maxHydratedSources=3",
    );

    // When
    const overrides = getDataSourceParamOverrides(url);

    // Then
    expect(overrides).toEqual({
      url: "http://a/1.mcap,http://a/2.mcap",
      maxHydratedSources: "3",
    });
  });
});

describe("resolveScenarioDataSourceParams", () => {
  it("should return the registry params unchanged when there are no overrides", () => {
    // Given
    const params = { url: "http://registry/file.mcap" };
    const scenario = buildScenario({ factoryId: "f", params, requiredParams: ["url"] });

    // When
    const result = resolveScenarioDataSourceParams(
      scenario,
      new URL("http://localhost/?scenario=x"),
    );

    // Then
    expect(result.params).toBe(params);
    expect(result.missingParams).toEqual([]);
  });

  it("should merge overrides over the registry params", () => {
    // Given
    const scenario = buildScenario({
      factoryId: "f",
      params: { maxHydratedSources: "1", keep: "yes" },
      requiredParams: ["url"],
    });
    const url = new URL(
      "http://localhost/?ds.url=http://a/1.mcap,http://a/2.mcap&ds.maxHydratedSources=4",
    );

    // When
    const result = resolveScenarioDataSourceParams(scenario, url);

    // Then
    expect(result).toEqual({
      params: { url: "http://a/1.mcap,http://a/2.mcap", maxHydratedSources: "4", keep: "yes" },
      missingParams: [],
    });
  });

  it("should report required params that are missing after merging", () => {
    // Given
    const scenario = buildScenario({
      factoryId: "f",
      params: { maxHydratedSources: "1" },
      requiredParams: ["url"],
    });

    // When
    const result = resolveScenarioDataSourceParams(scenario, new URL("http://localhost/"));

    // Then
    expect(result.missingParams).toEqual(["url"]);
  });

  it("should report nothing missing for scenarios without required params or params", () => {
    // Given
    const scenario = buildScenario({ factoryId: "sinewave" });

    // When
    const result = resolveScenarioDataSourceParams(scenario, new URL("http://localhost/"));

    // Then
    expect(result).toEqual({ params: undefined, missingParams: [] });
  });
});

describe("resolveScenarioDurationMs", () => {
  const withDuration: Scenario = { ...buildScenario({ factoryId: "f" }), durationMs: 10_000 };

  it("should use a positive ?scenario.durationMs= override", () => {
    // Given
    const url = new URL("http://localhost/?scenario=x&scenario.durationMs=30000");

    // When
    const durationMs = resolveScenarioDurationMs(withDuration, url);

    // Then
    expect(durationMs).toBe(30_000);
  });

  it("should apply the override to scenarios without a registry duration", () => {
    // Given
    const url = new URL("http://localhost/?scenario.durationMs=2500");

    // When
    const durationMs = resolveScenarioDurationMs(buildScenario({ factoryId: "f" }), url);

    // Then
    expect(durationMs).toBe(2_500);
  });

  it.each([
    "",
    "0",
    "-1",
    "abc",
    "Infinity",
  ])("should keep the registry duration for the invalid override %p", (raw) => {
    // Given
    const url = new URL(`http://localhost/?scenario.durationMs=${raw}`);

    // When
    const durationMs = resolveScenarioDurationMs(withDuration, url);

    // Then
    expect(durationMs).toBe(10_000);
  });

  it("should return undefined without override nor registry duration", () => {
    // Given / When
    const durationMs = resolveScenarioDurationMs(
      buildScenario({ factoryId: "f" }),
      new URL("http://localhost/"),
    );

    // Then
    expect(durationMs).toBeUndefined();
  });
});
