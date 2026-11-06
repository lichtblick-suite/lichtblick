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

describe("buildScenarioParams", () => {
  it("should leave normal runs unchanged", () => {
    // Given / When
    const params = buildScenarioParams(AUTO_PAUSING, { fixtureUrls: ["http://x/a.mcap"] });

    // Then
    expect(params.get("scenario")).toBe("mcap-multi-ingest");
    expect(params.get("scenario.durationMs")).toBeNull();
    expect(params.get("telemetry")).toBeNull();
  });

  it("should turn off telemetry for telemetry-off runs", () => {
    // Given / When
    const off = buildScenarioParams(SYNTHETIC, { telemetryEnabled: false });

    // Then
    expect(off.get("telemetry")).toBe("off");
  });

  it("should pass the calibrated late-frame threshold", () => {
    // Given / When
    const params = buildScenarioParams(SYNTHETIC, {}, { lateFrameThresholdMs: 25 });

    // Then
    expect(params.get("telemetry.lateFrameThresholdMs")).toBe("25");
  });

  it("should join the MCAP fixture URLs into ds.url", () => {
    // Given / When
    const params = buildScenarioParams(AUTO_PAUSING, {
      fixtureUrls: ["http://x/a.mcap", "http://x/b.mcap"],
    });

    // Then
    expect(params.get("ds.url")).toBe("http://x/a.mcap,http://x/b.mcap");
  });

  it("should reject MCAP scenarios without fixture URLs", () => {
    // Given / When / Then
    expect(() => buildScenarioParams(AUTO_PAUSING, {})).toThrow(/needs MCAP fixture URLs/);
  });
});
