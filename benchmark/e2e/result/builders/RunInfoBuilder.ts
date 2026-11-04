// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { RenderCalibrationV1, RunInfoV1, ScenarioDescriptorV1 } from "../schemaV1";

/** Deterministic, schema-valid `run` parts for the v1 result tests. */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RunInfoBuilder {
  /** A `run.scenario` for `scenarioId` (a sinewave-like synthetic Plot scenario by default). */
  public static scenario(
    scenarioId = "sinewave",
    overrides: Partial<ScenarioDescriptorV1> = {},
  ): ScenarioDescriptorV1 {
    return {
      scenarioId,
      description: "One Plot panel charting a synthetic sine wave signal.",
      group: "time-series",
      tags: ["plot", "synthetic"],
      layout: "sinewave",
      dataSource: { factoryId: "sinewave", displayName: "Synthetic" },
      player: "SinewavePlayer",
      params: {},
      panels: [{ id: "Plot!a", type: "Plot", title: "10 second window" }],
      ...overrides,
    };
  }

  /** The render calibration fields of `run.environment` (a 60 Hz display). */
  public static calibration(overrides: Partial<RenderCalibrationV1> = {}): RenderCalibrationV1 {
    return {
      fpsCeiling: 60,
      glRenderer: "ANGLE (Test GPU)",
      lateFrameThresholdMs: 25,
      ...overrides,
    };
  }

  /**
   * A complete `run` of a scenario run (10 s window at 1 Hz). `scenario` defaults to a descriptor of `scenarioId`;
   * `environment` overrides are merged over the defaults (host + calibration).
   */
  public static run(
    overrides: Partial<Omit<RunInfoV1, "environment">> & {
      environment?: Partial<RunInfoV1["environment"]>;
    } = {},
  ): RunInfoV1 {
    const { environment, ...rest } = overrides;
    const scenarioId = rest.scenarioId ?? "sinewave";
    return {
      scenarioId,
      pipeline: "synthetic",
      platform: "web",
      telemetryEnabled: true,
      startedAtWall: "2026-01-01T00:00:00.000Z",
      finishedAtWall: "2026-01-01T00:00:10.000Z",
      startMonotonicTs: 0,
      endMonotonicTs: 10_000,
      mode: "scenario",
      sampleIntervalMs: 1000,
      scenario: RunInfoBuilder.scenario(scenarioId),
      ...rest,
      environment: {
        os: "linux",
        arch: "x64",
        ci: true,
        cpuModel: "cpu",
        logicalCpus: 8,
        totalMemBytes: 1024,
        ...RunInfoBuilder.calibration(),
        ...environment,
      },
    };
  }
}
