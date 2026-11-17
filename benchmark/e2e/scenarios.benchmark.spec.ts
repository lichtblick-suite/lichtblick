// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import { test, expect } from "./fixtures/benchmark-electron";
import type {
  ScenarioUnderTest,
  FrameTimeSample,
  MemorySample,
  BenchmarkArtifact,
  RenderStatsWindow,
} from "./types";
import { BenchmarkMemoryMetric } from "../desktop/common/types";

const SAMPLE_DURATION_MS = 5_000;
const MEMORY_SAMPLE_INTERVAL_MS = 500;
const ARTIFACTS_DIR = path.resolve(__dirname, "../.artifacts");
// Set to a lichtblick-stress generated file (e.g. served by its `npm run serve`) to run stress-mixed.
const STRESS_MCAP_URL = process.env.LICHTBLICK_STRESS_MCAP_URL;
const PERF_HUD_URL = process.env.LICHTBLICK_PERF_HUD_URL;
const STRESS_SAMPLE_DURATION_MS = Number(process.env.LICHTBLICK_BENCHMARK_SAMPLE_MS ?? 30_000);
if (!Number.isFinite(STRESS_SAMPLE_DURATION_MS) || STRESS_SAMPLE_DURATION_MS <= 0) {
  throw new Error("LICHTBLICK_BENCHMARK_SAMPLE_MS must be a positive number of milliseconds");
}
// Records a main-thread `.cpuprofile` (open in DevTools > Performance) next to each artifact.
const RECORD_CPU_PROFILE = process.env.LICHTBLICK_BENCHMARK_PROFILE === "1";
// Per-component React render counts; most useful with a LICHTBLICK_BENCHMARK_REACT_PROFILING=1 build.
const RECORD_RENDER_STATS = process.env.LICHTBLICK_BENCHMARK_RENDER_STATS === "1";
const CPU_PROFILE_SAMPLING_INTERVAL_US = 1_000;

// One entry per registered scenario (`benchmark/src/scenarios/registry.ts`), copied rather than
// imported per this suite's raw-artifact contract (see `BenchmarkArtifact` doc below): this file
// deliberately doesn't reflect on the registry, so a scenario/registry change can't silently
// change what CI benchmarks without a corresponding change here.
const SCENARIOS_UNDER_TEST: readonly ScenarioUnderTest[] = [
  { scenarioId: "sinewave", pipeline: "synthetic" },
  { scenarioId: "pointcloud", pipeline: "synthetic" },
  { scenarioId: "transform", pipeline: "synthetic" },
  { scenarioId: "transformpreloading", pipeline: "synthetic" },
  // { scenarioId: "mcap-ingest", pipeline: "real", durationMs: SAMPLE_DURATION_MS }, // since we don't have a real data source for this scenario in the CI environment, skip it
  ...(STRESS_MCAP_URL != undefined && STRESS_MCAP_URL !== ""
    ? [
        {
          scenarioId: "stress-mixed",
          pipeline: "real" as const,
          mcapUrl: STRESS_MCAP_URL,
          perfHudUrl: PERF_HUD_URL !== "" ? PERF_HUD_URL : undefined,
          sampleDurationMs: STRESS_SAMPLE_DURATION_MS,
        },
      ]
    : []),
];

for (const scenario of SCENARIOS_UNDER_TEST) {
  test(`should run the ${scenario.scenarioId} ${scenario.pipeline}-pipeline scenario and collect memory/frame-time samples`, async ({
    mainWindow,
  }) => {
    const frameTimeSamples: FrameTimeSample[] = [];
    const sampleDurationMs = scenario.sampleDurationMs ?? SAMPLE_DURATION_MS;
    // Keep the config's 120 s budget for startup and teardown on top of the sampling window.
    test.setTimeout(sampleDurationMs + 120_000);

    // Given
    await mainWindow.exposeFunction("recordFrameTimes", (samples: FrameTimeSample[]) => {
      frameTimeSamples.push(...samples);
    });

    const startedAt = new Date().toISOString();
    console.log(`Starting scenario: ${scenario.scenarioId}`, startedAt);
    const scenarioUrl = new URL(mainWindow.url());
    scenarioUrl.searchParams.set("scenario", scenario.scenarioId);
    if (scenario.mcapUrl != undefined) {
      scenarioUrl.searchParams.set("mcapUrl", scenario.mcapUrl);
    }
    if (scenario.perfHudUrl != undefined) {
      scenarioUrl.searchParams.set("perfHudUrl", scenario.perfHudUrl);
    }
    if (RECORD_RENDER_STATS) {
      scenarioUrl.searchParams.set("renderStats", "1");
    }
    await mainWindow.goto(scenarioUrl.toString());

    const cdp = RECORD_CPU_PROFILE
      ? await mainWindow.context().newCDPSession(mainWindow)
      : undefined;
    if (cdp) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", {
        interval: CPU_PROFILE_SAMPLING_INTERVAL_US,
      });
      await cdp.send("Profiler.start");
    }
    if (RECORD_RENDER_STATS) {
      await mainWindow.evaluate(() => {
        (window as unknown as RenderStatsWindow).lichtblickRenderStats?.reset();
      });
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

    // When
    await mainWindow.waitForTimeout(sampleDurationMs);
    samplingState.active = false;
    await samplingLoop;

    const cpuProfile = cdp ? (await cdp.send("Profiler.stop")).profile : undefined;
    await cdp?.detach();

    const renderStats = RECORD_RENDER_STATS
      ? await mainWindow.evaluate(() =>
          (window as unknown as RenderStatsWindow).lichtblickRenderStats?.snapshot(),
        )
      : undefined;

    const perfHudSamples =
      scenario.perfHudUrl != undefined
        ? await mainWindow.evaluate(() => {
            const hud = (
              window as unknown as {
                lichtblickPerfHud?: { samples: () => Record<string, number | null>[] };
              }
            ).lichtblickPerfHud;
            return hud?.samples() ?? [];
          })
        : undefined;

    const finishedAt = new Date().toISOString();

    if (scenario.pipeline === "real") {
      await mainWindow.getByRole("button", { name: "Pause", exact: true }).click();
    }

    // Then
    expect(memorySamples.length).toBeGreaterThan(0);
    if (perfHudSamples != undefined) {
      expect(perfHudSamples.length).toBeGreaterThan(0);
    }

    const artifact: BenchmarkArtifact = {
      scenarioId: scenario.scenarioId,
      pipeline: scenario.pipeline,
      startedAt,
      finishedAt,
      memorySamples,
      frameTimeSamples,
      perfHudSamples,
      renderStats,
    };

    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const baseName = `${scenario.scenarioId}-${Date.now()}`;
    if (cpuProfile) {
      artifact.cpuProfileFile = `${baseName}.cpuprofile`;
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, artifact.cpuProfileFile),
        JSON.stringify(cpuProfile),
      );
    }
    const artifactPath = path.join(ARTIFACTS_DIR, `${baseName}.json`);
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, undefined, 2));
  });
}
