// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import { test, expect } from "./fixtures/benchmark";
import type { LaunchTargetOptions } from "./fixtures/types";
import {
  DIRECT_ATTRIBUTION_LABEL,
  directAttributionFlagsText,
  directAttributionText,
  directAttributionTopText,
  TOGGLE_FRAME_PROBE_LABEL,
  toggleProcessDeltasText,
} from "./report/overheadText";
import { DIRECT_ATTRIBUTION_TELEMETRY_SOURCES } from "./result/constants";
import { buildDirectAttribution } from "./result/directAttribution";
import type { DirectAttributionV3 } from "./result/directAttribution.types";
import { validateResultV1 } from "./result/schemaV1";
import type { BenchmarkPlatform, BenchmarkResultV1 } from "./result/schemaV1";
import { writeResultV1 } from "./runner/artifacts";
import { createBundleSourceResolver } from "./runner/bundleSourceResolver";
import {
  ARTIFACTS_DIR,
  OVERHEAD_ARM_FILE_VARIANTS,
  OVERHEAD_DRAIN_INTERVAL_MS,
  OVERHEAD_PROFILE_SAMPLING_INTERVAL_US,
  OVERHEAD_SCENARIOS,
  OVERHEAD_TARGETS,
  OVERHEAD_TOGGLE_SETTLE_MS,
  OVERHEAD_TOGGLE_WARMUP_MS,
  OVERHEAD_WARMUP_MS,
  OVERHEAD_WEB_BROWSER,
  RENDERER_BUNDLE_LAYOUTS,
  SAMPLE_INTERVAL_MS,
} from "./runner/constants";
import { buildOverheadReport, overheadFileName } from "./runner/overhead";
import type {
  OverheadEnvConfig,
  OverheadReport,
  OverheadRunInput,
  ScheduledOverheadRun,
} from "./runner/overhead.types";
import {
  armRunOptions,
  buildOverheadSchedule,
  overheadArms,
  overheadTestTimeoutMs,
  parseOverheadConfig,
  runsRelaunch,
  runsToggleFrameProbe,
  toggleUaProbeVariants,
} from "./runner/overheadSchedule";
import { runScenario } from "./runner/runScenario";
import { getScenarioUnderTest } from "./runner/scenariosUnderTest";
import {
  BLOCKS_PER_QUARTET,
  summarizeToggle,
  toggleBlockArms,
  toggleOffCpuPercent,
} from "./runner/toggleBlocks";
import type { OverheadToggleSummaryV3, ToggleConfigV3 } from "./runner/toggleBlocks.types";
import type { DisposableBenchmarkTarget, RunScenarioOptions, ToggleTarget } from "./runner/types";
import { runSequentially } from "./shared/sequential";
import type { ScenarioUnderTest } from "./types";

// Telemetry overhead A/B (see `runner/overhead.ts` and the README "Telemetry overhead"), by
// `BENCHMARK_OVERHEAD_METHOD` (default `both`): `toggle` = one app launch per scenario with
// telemetry switched off / on in-process in ABBA quartets of blocks (`runner/toggleBlocks.ts`; CPU
// verdict only), `relaunch` = the A/B below (CPU and memory), `both` = CPU verdict from toggle, memory
// verdict from relaunch (relaunch CPU reported as secondary). Order: the warm-up runs, the toggle
// run(s), then the measured relaunch runs. On web with `BENCHMARK_OVERHEAD_UA_ARM=1` a second toggle
// launch runs without the UA memory probe (`?telemetry.uaMemory=off`, report
// `toggleWithoutUaProbe`, informational), isolating the probe's share of the toggle CPU delta. The
// first toggle launch ends with a profiled period (`BENCHMARK_OVERHEAD_PROFILE_MS`, default 10 s,
// telemetry on): the direct (JS only) CPU attribution of the report (`directAttribution`). The
// benchmark FPS probe's rAF frame loop runs in both arms of the telemetry toggle (harness, like the
// relaunch main-thread probe); `BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1` adds a last toggle launch with
// telemetry off that toggles only that frame loop (`toggleFrameProbe`, its cost; informational).
//
// Relaunch: per scenario, `BENCHMARK_OVERHEAD_WARMUP_RUNS` discarded runs, then
// `BENCHMARK_OVERHEAD_REPEATS`
// repeats of every arm (telemetry off / on, plus on without the UA memory probe on web with
// `BENCHMARK_OVERHEAD_UA_ARM=1`) in a balanced order (ABBA / Latin square). Every run is a freshly
// launched app instance (the previous one closed first) measured over a fixed-schedule steady
// window of `BENCHMARK_OVERHEAD_POLLS` host polls (default 10); on web every arm runs in the full
// Chromium (`OVERHEAD_WEB_BROWSER`, provides the UA memory API). MCAP scenarios read the longer
// overhead fixtures (`overheadFixtureUrls`, sized for the poll count), so data keeps flowing until
// the last poll. Writes `benchmark/.artifacts/overhead-<platform>-<scenario>-<ts>.json`
// (schema 3, with the toggle blocks and quartets) plus every measured run's v1 result with `run.mode: "overhead"`, tagged `-overhead-`
// (`…-telemetry-off-overhead-…` for the baseline, `…-overhead-ua-memory-off-…` for the UA arm; no
// legacy artifacts). Those runs stay out of the scenario views (viewer, CI summary). Report only,
// unless `BENCHMARK_OVERHEAD_GATE=1` (then an overall `exceeds` verdict fails).
//
// Screenshots are explicitly disabled (a `page.screenshot()` costs renderer/GPU/browser CPU and
// memory and would add noise to the A/B).

/** Overhead `runScenario` options of a scheduled run with `polls` steady polls. */
function overheadRunOptions(
  entry: ScheduledOverheadRun,
  fixtureUrls: readonly string[],
  polls: number,
): RunScenarioOptions {
  return {
    ...armRunOptions(entry.arm),
    fixtureUrls,
    screenshots: false,
    measurement: { mode: "steady", warmupMs: OVERHEAD_WARMUP_MS, polls },
  };
}

/** Toggle A/B settings of the env. */
function toggleConfig(env: OverheadEnvConfig): ToggleConfigV3 {
  return {
    quartets: env.toggleQuartets,
    blockMs: env.toggleBlockMs,
    settleMs: OVERHEAD_TOGGLE_SETTLE_MS,
    warmupMs: OVERHEAD_TOGGLE_WARMUP_MS,
    drainIntervalMs: OVERHEAD_DRAIN_INTERVAL_MS,
  };
}

/** A toggle launch: its summary and, when it was profiled, the direct CPU attribution. */
type ToggleArmResult = {
  summary: OverheadToggleSummaryV3;
  directAttribution?: DirectAttributionV3;
};

/**
 * The toggle A/B of a scenario: one app launch with telemetry on, switched off / on per ABBA block
 * (`runner/toggleWindow.ts`), summarized into the report's `toggle` section (or
 * `toggleWithoutUaProbe` with `uaMemoryProbe: false`; with `toggled: "frameProbe"` a launch with
 * telemetry off toggling only the frame loop, `toggleFrameProbe`). With `profileMs` > 0 the launch ends with a
 * profiled period, attributed to telemetry sources through the build's source maps
 * (`directAttribution`). No v1 result is written (the run has no steady window; the blocks are in
 * the report).
 */
async function runToggleArm({
  launchTarget,
  platform,
  scenario,
  fixtureUrls,
  config,
  uaMemoryProbe,
  profileMs,
  toggled = "telemetry",
}: {
  launchTarget: (options?: LaunchTargetOptions) => Promise<DisposableBenchmarkTarget>;
  platform: BenchmarkPlatform;
  scenario: ScenarioUnderTest;
  fixtureUrls: readonly string[];
  config: ToggleConfigV3;
  uaMemoryProbe: boolean;
  profileMs: number;
  toggled?: ToggleTarget;
}): Promise<ToggleArmResult> {
  const startedMs = Date.now();
  const target = await launchTarget({ webBrowser: OVERHEAD_WEB_BROWSER });
  const run = await runScenario(target, scenario, {
    telemetryEnabled: toggled === "telemetry",
    uaMemoryProbe,
    fixtureUrls,
    screenshots: false,
    measurement: {
      mode: "toggle",
      warmupMs: config.warmupMs,
      arms: toggleBlockArms(config.quartets),
      blockMs: config.blockMs,
      settleMs: config.settleMs,
      profileMs,
      toggled,
    },
  });
  await target.dispose();
  if (run.toggle == undefined) {
    throw new Error(`Toggle run of ${scenario.scenarioId} returned no blocks`);
  }
  const summary = summarizeToggle({
    recordings: run.toggle.blocks,
    records: run.toggle.records,
    config,
    cpuDeltaRelativeMax: OVERHEAD_TARGETS.cpuDeltaRelativeMax,
    runDurationMs: Date.now() - startedMs,
  });
  const capture = run.toggle.profile;
  if (capture == undefined) {
    return { summary };
  }
  const directAttribution = buildDirectAttribution({
    capture,
    resolve: createBundleSourceResolver(RENDERER_BUNDLE_LAYOUTS[platform]),
    config: {
      profileMs,
      samplingIntervalUs: OVERHEAD_PROFILE_SAMPLING_INTERVAL_US,
      telemetrySources: DIRECT_ATTRIBUTION_TELEMETRY_SOURCES,
    },
    offCpuPercent: toggleOffCpuPercent(summary.quartets),
    target: OVERHEAD_TARGETS.cpuDeltaRelativeMax,
  });
  return { summary, directAttribution };
}

const ci = (lower?: number, upper?: number) => `[${lower ?? "?"}, ${upper ?? "?"}]`;

/** Relative deltas in percent (2 decimals), `x` for an excluded unit: `+1.23,-0.50,x`. */
function deltasText(units: readonly { cpuRelative?: number; excluded: boolean }[]): string {
  return units
    .map(({ cpuRelative, excluded }) =>
      excluded || cpuRelative == undefined
        ? "x"
        : `${cpuRelative >= 0 ? "+" : ""}${(cpuRelative * 100).toFixed(2)}`,
    )
    .join(",");
}

/**
 * Console summary parts of a toggle section, each prefixed with `label`; the verdict unless
 * `harness` (the benchmark FPS probe has none).
 */
function toggleSummaryParts(
  label: string,
  toggle: OverheadToggleSummaryV3,
  { harness = false }: { harness?: boolean } = {},
): string[] {
  const rel = toggle.metrics.cpuRelative;
  const pp = toggle.metrics.cpuPctPoints;
  return [
    `${label} quartets n=${toggle.n} (excluded ${toggle.excludedQuartets})`,
    `${label} quartet cpuRelative % [${deltasText(toggle.quartets)}]`,
    `${label} pair cpuRelative % (diagnostic) [${deltasText(toggle.pairs)}]`,
    `${label} block cpu % [${toggle.blocks.map((block) => `${block.arm}:${block.cpuPercent.toFixed(1)}`).join(",")}]`,
    `${label} run ${((toggle.runDurationMs ?? 0) / 1000).toFixed(1)} s`,
    `${label} cpuRelative median=${rel.median} ci95=${ci(rel.ci95?.lower, rel.ci95?.upper)}`,
    `${label} cpuPp median=${pp.median} ci95=${ci(pp.ci95?.lower, pp.ci95?.upper)}`,
    `${label} latency max=${toggle.toggleLatencyMsMax.toFixed(0)} ms`,
    `${label} renderer records off/on=${toggle.rendererRecords.offBlocks}/${toggle.rendererRecords.onBlocks}`,
    `${label} UA calls off/on=${toggle.uaCalls.offBlocks}/${toggle.uaCalls.onBlocks}`,
    `${label} by process ${toggleProcessDeltasText(toggle)}`,
    ...(harness ? [] : [`${label} verdict=${toggle.verdict}`]),
  ];
}

/** Console summary parts of the direct CPU attribution. */
function directAttributionSummaryParts(section: DirectAttributionV3): string[] {
  if (section.status === "unsupported") {
    return [`${DIRECT_ATTRIBUTION_LABEL} unsupported: ${section.reason}`];
  }
  return [
    `${DIRECT_ATTRIBUTION_LABEL} ${directAttributionText(section)}`,
    `${DIRECT_ATTRIBUTION_LABEL} ${directAttributionFlagsText(section)}`,
    `${DIRECT_ATTRIBUTION_LABEL} top ${directAttributionTopText(section)}`,
    `${DIRECT_ATTRIBUTION_LABEL} verdict=${section.verdict}`,
  ];
}

/** One-line console summary of a report. */
function reportSummary(report: OverheadReport): string {
  const { cpuRelative, memBytes } = report.metrics;
  const parts = [
    `method=${report.method} cpu from ${report.cpuVerdictSource}, mem from ${report.memVerdictSource}`,
  ];
  if (report.toggle != undefined) {
    parts.push(...toggleSummaryParts("toggle", report.toggle));
  }
  if (report.toggleWithoutUaProbe != undefined) {
    parts.push(...toggleSummaryParts("toggle-noUa", report.toggleWithoutUaProbe));
  }
  if (report.toggleFrameProbe != undefined) {
    parts.push(
      `toggle-frameProbe = ${TOGGLE_FRAME_PROBE_LABEL}`,
      ...toggleSummaryParts("toggle-frameProbe", report.toggleFrameProbe, { harness: true }),
    );
  }
  if (report.directAttribution != undefined) {
    parts.push(...directAttributionSummaryParts(report.directAttribution));
  }
  if (report.relaunchVerdicts != undefined) {
    parts.push(
      `relaunch n=${report.n} (excluded ${report.excludedPairs})`,
      `relaunch cpuRelative median=${cpuRelative.median} ci95=${ci(cpuRelative.ci95?.lower, cpuRelative.ci95?.upper)}`,
      `relaunch memBytes median=${memBytes.median} ci95=${ci(memBytes.ci95?.lower, memBytes.ci95?.upper)}`,
    );
  }
  parts.push(`verdict=${report.verdicts.overall}`);
  return parts.join(" · ");
}

for (const scenarioId of OVERHEAD_SCENARIOS) {
  test(`should measure the telemetry overhead of the ${scenarioId} scenario`, async ({
    platform,
    launchTarget,
    overheadFixtureUrls,
  }) => {
    const env = parseOverheadConfig(process.env, platform);
    const toggleVariants = toggleUaProbeVariants(env);
    const frameProbe = runsToggleFrameProbe(env);
    const repeats = runsRelaunch(env.method) ? env.repeats : 0;
    const arms = overheadArms(env);
    const schedule = buildOverheadSchedule({ arms, repeats, warmupRuns: env.warmupRuns });
    const toggleSettings = toggleConfig(env);
    test.setTimeout(
      overheadTestTimeoutMs(
        schedule.length,
        env.polls,
        toggleVariants.length > 0
          ? {
              quartets: env.toggleQuartets,
              blockMs: env.toggleBlockMs,
              runs: toggleVariants.length + (frameProbe ? 1 : 0),
              profileMs: env.profileMs,
            }
          : undefined,
      ),
    );
    const scenario = getScenarioUnderTest(scenarioId);
    const runs: OverheadRunInput[] = [];
    const results: BenchmarkResultV1[] = [];
    const warmups = schedule.filter((entry) => entry.warmup);
    const measured = schedule.filter((entry) => !entry.warmup);

    // Every run in its own app instance (closed before the next launch).
    const runRelaunch = async (entry: ScheduledOverheadRun): Promise<void> => {
      const target = await launchTarget({ webBrowser: OVERHEAD_WEB_BROWSER });
      const run = await runScenario(
        target,
        scenario,
        overheadRunOptions(entry, overheadFixtureUrls.relaunch, env.polls),
      );
      await target.dispose();
      if (entry.warmup) {
        return;
      }
      const resultPath = writeResultV1({ ...run, variant: OVERHEAD_ARM_FILE_VARIANTS[entry.arm] });
      results.push(run.result);
      runs.push({
        arm: entry.arm,
        repeat: entry.repeat,
        order: entry.order,
        sequence: entry.sequence,
        resultFile: path.basename(resultPath),
        result: run.result,
      });
    };

    // Given / When: warm-up runs, the toggle run(s) (UA probe on, then off, then the frame probe),
    // then the measured relaunch runs
    await runSequentially(warmups.length, async (index) => {
      await runRelaunch(warmups[index]!);
    });
    const toggles = new Map<boolean, ToggleArmResult>();
    await runSequentially(toggleVariants.length, async (index) => {
      const uaMemoryProbe = toggleVariants[index]!;
      toggles.set(
        uaMemoryProbe,
        await runToggleArm({
          launchTarget,
          platform,
          scenario,
          fixtureUrls: overheadFixtureUrls.toggle,
          config: toggleSettings,
          uaMemoryProbe,
          // Only the primary launch (UA probe on, as shipped) is profiled.
          profileMs: uaMemoryProbe ? env.profileMs : 0,
        }),
      );
    });
    const toggle = toggles.get(true)?.summary;
    const toggleWithoutUaProbe = toggles.get(false)?.summary;
    const directAttribution = toggles.get(true)?.directAttribution;
    const toggleFrameProbe = frameProbe
      ? (
          await runToggleArm({
            launchTarget,
            platform,
            scenario,
            fixtureUrls: overheadFixtureUrls.toggle,
            config: toggleSettings,
            uaMemoryProbe: false,
            profileMs: 0,
            toggled: "frameProbe",
          })
        ).summary
      : undefined;
    await runSequentially(measured.length, async (index) => {
      await runRelaunch(measured[index]!);
    });
    const report = buildOverheadReport({
      platform,
      scenarioId,
      method: env.method,
      runs,
      ...(toggle != undefined && { toggle }),
      ...(toggleWithoutUaProbe != undefined && { toggleWithoutUaProbe }),
      ...(toggleFrameProbe != undefined && { toggleFrameProbe }),
      ...(directAttribution != undefined && { directAttribution }),
      config: {
        repeats,
        warmupRuns: env.warmupRuns,
        arms,
        warmupMs: OVERHEAD_WARMUP_MS,
        polls: env.polls,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
      },
    });
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const reportPath = path.join(ARTIFACTS_DIR, overheadFileName(platform, scenarioId, Date.now()));
    fs.writeFileSync(reportPath, JSON.stringify(report, undefined, 2));
    console.debug(`Wrote ${reportPath}: ${reportSummary(report)}`);

    // Then
    for (const result of results) {
      expect(validateResultV1(result)).toEqual([]);
      expect(result.run.mode).toBe("overhead");
      expect(result.summary.steadyWindow).toBeDefined();
      expect(result.summary.steadyWindow?.requestedPolls).toBe(env.polls);
    }
    // Telemetry off: nothing is recorded in the page.
    for (const result of results.filter((entry) => !entry.run.telemetryEnabled)) {
      expect(result.events).toHaveLength(0);
    }
    expect(report.runs).toHaveLength(repeats * arms.length);
    for (const { summary: section } of toggles.values()) {
      expect(section.blocks).toHaveLength(env.toggleQuartets * BLOCKS_PER_QUARTET);
      expect(section.quartets).toHaveLength(env.toggleQuartets);
      // Off blocks record nothing in the renderer realm and never call the UA memory API.
      expect(section.rendererRecords.offBlocks).toBe(0);
      expect(section.rendererRecords.onBlocks).toBeGreaterThan(0);
      expect(section.uaCalls.offBlocks).toBe(0);
    }
    // Frame probe: telemetry off in both arms, so nothing is recorded and the UA API is never called.
    if (toggleFrameProbe != undefined) {
      expect(toggleFrameProbe.blocks).toHaveLength(env.toggleQuartets * BLOCKS_PER_QUARTET);
      expect(toggleFrameProbe.quartets).toHaveLength(env.toggleQuartets);
      expect(toggleFrameProbe.rendererRecords).toEqual({ offBlocks: 0, onBlocks: 0 });
      expect(toggleFrameProbe.uaCalls).toEqual({ offBlocks: 0, onBlocks: 0 });
      expect(report.toggleFrameProbe).toBeDefined();
    }
    // Without the probe the UA memory API is never called.
    expect(toggleWithoutUaProbe?.uaCalls.onBlocks ?? 0).toBe(0);
    // The toggle launch is profiled (or the profiler is recorded as unsupported) unless disabled.
    if (toggle != undefined && env.profileMs > 0) {
      expect(report.directAttribution).toBeDefined();
    }
    if (report.directAttribution?.status === "measured") {
      expect(report.directAttribution.samples).toBeGreaterThan(0);
      expect(report.directAttribution.telemetryMsPerSec).toBeLessThanOrEqual(
        report.directAttribution.jsMsPerSec,
      );
    }
    if (env.gate) {
      expect(report.verdicts.overall).not.toBe("exceeds");
    }
  });
}
