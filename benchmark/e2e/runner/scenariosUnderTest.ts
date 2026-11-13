// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ScenarioUnderTest } from "../types";

// Single source of the scenarios benchmarked on both platforms. One entry per registered scenario
// (`benchmark/src/scenarios/registry.ts`), copied rather than imported: the suite deliberately
// doesn't reflect on the registry, so a registry change can't silently change what CI benchmarks
// without a corresponding change here.
export const SCENARIOS_UNDER_TEST: readonly ScenarioUnderTest[] = [
  { scenarioId: "sinewave", pipeline: "synthetic" },
  { scenarioId: "pointcloud", pipeline: "synthetic" },
  { scenarioId: "transform", pipeline: "synthetic" },
  { scenarioId: "transformpreloading", pipeline: "synthetic" },
  // { scenarioId: "mcap-ingest", pipeline: "real", durationMs: 5_000 }, // since we don't have a real data source for this scenario in the CI environment, skip it
  // Real pipeline on runtime-generated, fully overlapping MCAP fixtures (`maxHydratedSources: 1`
  // forces the HydratedSourcePool over budget: evictions/rehydrations).
  {
    scenarioId: "mcap-multi-ingest",
    pipeline: "real",
    durationMs: 10_000,
    usesMcapFixtures: true,
    expectsHydratedPoolOverBudget: true,
  },
];

export function getScenarioUnderTest(scenarioId: string): ScenarioUnderTest {
  const scenario = SCENARIOS_UNDER_TEST.find((candidate) => candidate.scenarioId === scenarioId);
  if (scenario == undefined) {
    throw new Error(`Unknown scenario under test: ${scenarioId}`);
  }
  return scenario;
}
