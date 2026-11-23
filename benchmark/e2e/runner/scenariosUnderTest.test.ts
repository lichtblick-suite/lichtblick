// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SCENARIOS_UNDER_TEST, getScenarioUnderTest } from "./scenariosUnderTest";

describe("SCENARIOS_UNDER_TEST", () => {
  it("should declare the hydrated pool over-budget expectation on mcap-multi-ingest", () => {
    // Given / When
    const scenario = getScenarioUnderTest("mcap-multi-ingest");

    // Then
    expect(scenario.expectsHydratedPoolOverBudget).toBe(true);
  });

  it("should only expect a hydrated pool over budget on real MCAP fixture scenarios", () => {
    // Given
    const flagged = SCENARIOS_UNDER_TEST.filter(
      (scenario) => scenario.expectsHydratedPoolOverBudget === true,
    );

    // When / Then: the pool exists only on the real pipeline, and the overlapping fixtures drive it
    // over budget
    expect(flagged.length).toBeGreaterThan(0);
    for (const scenario of flagged) {
      expect(scenario.pipeline).toBe("real");
      expect(scenario.usesMcapFixtures).toBe(true);
    }
  });

  it("should not expect a hydrated pool on synthetic scenarios", () => {
    // Given
    const synthetic = SCENARIOS_UNDER_TEST.filter((scenario) => scenario.pipeline === "synthetic");

    // When / Then
    expect(synthetic.length).toBeGreaterThan(0);
    for (const scenario of synthetic) {
      expect(scenario.expectsHydratedPoolOverBudget).toBeUndefined();
    }
  });

  it("should have unique scenario ids", () => {
    // Given
    const ids = SCENARIOS_UNDER_TEST.map((scenario) => scenario.scenarioId);

    // When / Then
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getScenarioUnderTest", () => {
  it("should throw for an unknown scenario id", () => {
    // Given / When / Then
    expect(() => getScenarioUnderTest("not-a-scenario")).toThrow(
      "Unknown scenario under test: not-a-scenario",
    );
  });
});
