// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RunInfoBuilder } from "./RunInfoBuilder";
import type { KpiRun, RunKpisInput, RunKpisV1 } from "../kpis.types";
import type { BenchmarkPlatform, ScenarioDescriptorV1, SummaryV1 } from "../schemaV1";

type KpiFamilies = Omit<RunKpisV1, "recomputed">;

/** Per-family overrides (each family merged over the defaults). */
export type RunKpisOverrides = { [K in keyof KpiFamilies]?: Partial<KpiFamilies[K]> };

type Summary = Omit<SummaryV1, "kpis">;

/** Deterministic `computeRunKpis` inputs and aggregated runs for the KPI tests. */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class RunKpisBuilder {
  /** A summary without KPIs: one host poll set (300 MiB, 50% CPU), no renderer/pipeline data. */
  public static summary(overrides: Partial<Summary> = {}): Summary {
    return {
      process: {
        sampleCount: 3,
        peakTotalWorkingSetBytes: 300 * 1024 * 1024,
        meanTotalWorkingSetBytes: 250 * 1024 * 1024,
        medianTotalCpuPercent: 50,
        byType: {},
      },
      renderer: {},
      phases: {},
      ...overrides,
    };
  }

  /** A `computeRunKpis` input: 10 s run (`[0, 10 s]`), 60 Hz ceiling, nothing dropped. */
  public static input(
    overrides: { summary?: Partial<Summary>; dropped?: Record<string, number> } & Partial<
      Pick<RunKpisInput, "run">
    > = {},
  ): RunKpisInput {
    return {
      run: overrides.run ?? {
        startMonotonicTs: 0,
        endMonotonicTs: 10_000,
        environment: { fpsCeiling: 60 },
      },
      dropped: overrides.dropped ?? {},
      summary: RunKpisBuilder.summary(overrides.summary),
    };
  }

  /** Healthy KPIs with no values; `overrides` are merged per family. */
  public static kpis(overrides: RunKpisOverrides = {}): RunKpisV1 {
    return {
      stability: { healthy: true, reasons: [], ...overrides.stability },
      memory: { ...overrides.memory },
      cpu: { ...overrides.cpu },
      smoothness: { lowFps: false, ...overrides.smoothness },
      startup: { ...overrides.startup },
      throughput: { ...overrides.throughput },
      renderCost: { p90RenderMsByPanelType: {}, ...overrides.renderCost },
    };
  }

  /** A run as aggregated (`aggregateKpis`, `groupKpis`), anchored `runId`. */
  public static run(props: {
    runId: string;
    scenarioId?: string;
    platform?: BenchmarkPlatform;
    telemetryEnabled?: boolean;
    scenario?: Partial<ScenarioDescriptorV1> | false;
    kpis?: RunKpisOverrides;
    summary?: Partial<Summary>;
  }): KpiRun {
    const scenarioId = props.scenarioId ?? "sinewave";
    const scenario =
      props.scenario === false ? undefined : RunInfoBuilder.scenario(scenarioId, props.scenario);
    return {
      runId: props.runId,
      result: {
        run: {
          scenarioId,
          platform: props.platform ?? "electron",
          telemetryEnabled: props.telemetryEnabled ?? true,
          scenario,
        },
        summary: {
          ...RunKpisBuilder.summary(props.summary),
          kpis: RunKpisBuilder.kpis(props.kpis),
        },
      },
    };
  }
}
