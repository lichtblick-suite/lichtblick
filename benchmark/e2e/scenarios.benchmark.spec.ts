// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import { test, expect } from "./fixtures/benchmark-electron";
import type { ScenarioUnderTest, FrameTimeSample, MemorySample, BenchmarkArtifact } from "./types";
import { BenchmarkMemoryMetric } from "../desktop/common/types";

const SAMPLE_DURATION_MS = 5_000;
const MEMORY_SAMPLE_INTERVAL_MS = 500;
const ARTIFACTS_DIR = path.resolve(__dirname, "../.artifacts");

// One entry per registered scenario (`benchmark/src/scenarios/registry.ts`), copied rather than
// imported per this suite's raw-artifact contract (see `BenchmarkArtifact` doc below): this file
// deliberately doesn't reflect on the registry, so a scenario/registry change can't silently
// change what CI benchmarks without a corresponding change here.
const SCENARIOS_UNDER_TEST: readonly ScenarioUnderTest[] = [
  { scenarioId: "sinewave", pipeline: "synthetic" },
  { scenarioId: "pointcloud", pipeline: "synthetic" },
  { scenarioId: "transform", pipeline: "synthetic" },
  { scenarioId: "transformpreloading", pipeline: "synthetic" },
  { scenarioId: "mcap-ingest", pipeline: "real", durationMs: SAMPLE_DURATION_MS },
];

for (const scenario of SCENARIOS_UNDER_TEST) {
  test(`should run the ${scenario.scenarioId} ${scenario.pipeline}-pipeline scenario and collect memory/frame-time samples`, async ({
    mainWindow,
  }) => {
    const frameTimeSamples: FrameTimeSample[] = [];

    // Given
    await mainWindow.exposeFunction("recordFrameTimes", (samples: FrameTimeSample[]) => {
      frameTimeSamples.push(...samples);
    });

    const startedAt = new Date().toISOString();
    const scenarioUrl = `${mainWindow.url()}?scenario=${scenario.scenarioId}`;
    await mainWindow.goto(scenarioUrl);

    // When
    if (scenario.pipeline === "real") {
      await expect(mainWindow.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    }

    const memorySamples: MemorySample[] = [];
    const samplingState = { active: true };
    const samplingLoop = (async () => {
      while (samplingState.active) {
        const metrics = await mainWindow.evaluate(async () => {
          const bridge = (
            window as unknown as {
              lichtblickBenchmark: { getMemoryMetrics: () => Promise<BenchmarkMemoryMetric[]> };
            }
          ).lichtblickBenchmark;
          return await bridge.getMemoryMetrics();
        });
        memorySamples.push({ timestampMs: Date.now(), metrics });
        await mainWindow.waitForTimeout(MEMORY_SAMPLE_INTERVAL_MS);
      }
    })();

    if (scenario.pipeline === "synthetic") {
      // No Play/Pause control exists for this pipeline: just sample for a fixed window.
      await mainWindow.waitForTimeout(SAMPLE_DURATION_MS);
    } else if (scenario.durationMs != undefined) {
      // The data source fetches/buffers over the network before autoStart can actually begin
      // playing; observed to take close to 30s on a slow connection, so a generous timeout is
      // needed to avoid flaking here rather than genuinely detecting a stuck data source.
      await expect(mainWindow.getByRole("button", { name: "Pause", exact: true })).toBeVisible({
        timeout: 60 * 1000,
      });
      // durationMs (registry.ts) elapses and the scenario auto-pauses, so Play reappears.
      await expect(mainWindow.getByRole("button", { name: "Play", exact: true })).toBeVisible({
        timeout: scenario.durationMs + 25 * 1000,
      });
    } else {
      // No auto-pause for this scenario (indefinite playback): sample for a fixed window, then
      // pause manually via the same toggle button (now showing "Pause").
      await mainWindow.waitForTimeout(SAMPLE_DURATION_MS);
      await mainWindow.getByRole("button", { name: "Pause", exact: true }).click();
    }
    samplingState.active = false;
    await samplingLoop;

    const finishedAt = new Date().toISOString();

    // Thens
    expect(memorySamples.length).toBeGreaterThan(0);

    const artifact: BenchmarkArtifact = {
      scenarioId: scenario.scenarioId,
      pipeline: scenario.pipeline,
      startedAt,
      finishedAt,
      memorySamples,
      frameTimeSamples,
    };

    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const artifactPath = path.join(ARTIFACTS_DIR, `${scenario.scenarioId}-${Date.now()}.json`);
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, undefined, 2));
  });
}
