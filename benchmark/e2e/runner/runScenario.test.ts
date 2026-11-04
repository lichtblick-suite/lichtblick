// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { buildScenarioParams } from "./runScenario";
import type { ScenarioUnderTest } from "../types";

const AUTO_PAUSING: ScenarioUnderTest = {
  scenarioId: "mcap-multi-ingest",
  pipeline: "real",
  durationMs: 10_000,
  usesMcapFixtures: true,
};
const SYNTHETIC: ScenarioUnderTest = { scenarioId: "sinewave", pipeline: "synthetic" };
const STEADY = { mode: "steady", warmupMs: 3000, polls: 10 } as const;

describe("buildScenarioParams", () => {
  it("should leave normal runs unchanged", () => {
    // Given / When
    const params = buildScenarioParams(AUTO_PAUSING, { fixtureUrls: ["http://x/a.mcap"] });

    // Then
    expect(params.get("scenario")).toBe("mcap-multi-ingest");
    expect(params.get("scenario.durationMs")).toBeNull();
    expect(params.get("telemetry.uaMemory")).toBeNull();
    expect(params.get("telemetry")).toBeNull();
  });

  it("should move the page auto-pause past the steady window", () => {
    // Given / When
    const params = buildScenarioParams(AUTO_PAUSING, {
      fixtureUrls: ["http://x/a.mcap"],
      measurement: STEADY,
    });

    // Then: 3 s warm-up + 10 × 1 s polls + 2 s margin
    expect(params.get("scenario.durationMs")).toBe("15000");
  });

  it("should not add an auto-pause to scenarios without one", () => {
    // Given / When
    const params = buildScenarioParams(SYNTHETIC, { measurement: STEADY });

    // Then
    expect(params.get("scenario.durationMs")).toBeNull();
  });

  it("should turn off telemetry or only the UA memory probe per arm", () => {
    // Given / When
    const off = buildScenarioParams(SYNTHETIC, { telemetryEnabled: false });
    const noUa = buildScenarioParams(SYNTHETIC, { telemetryEnabled: true, uaMemoryProbe: false });

    // Then
    expect(off.get("telemetry")).toBe("off");
    expect(off.get("telemetry.uaMemory")).toBeNull();
    expect(noUa.get("telemetry")).toBeNull();
    expect(noUa.get("telemetry.uaMemory")).toBe("off");
  });
});
