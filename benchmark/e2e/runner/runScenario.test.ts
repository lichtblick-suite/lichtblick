// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { buildScenarioParams } from "./runScenario";
import type { ScenarioUnderTest } from "../types";

const SYNTHETIC: ScenarioUnderTest = { scenarioId: "sinewave", pipeline: "synthetic" };

describe("buildScenarioParams", () => {
  it("should leave normal runs unchanged", () => {
    // Given / When
    const params = buildScenarioParams(SYNTHETIC, {});

    // Then
    expect(params.get("scenario")).toBe("sinewave");
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
});
