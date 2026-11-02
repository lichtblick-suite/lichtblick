// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import { test, expect } from "./fixtures/benchmark";
import { validateResultV1 } from "./result/schemaV1";
import { writeResultV1 } from "./runner/artifacts";
import { ARTIFACTS_DIR } from "./runner/constants";
import { buildOverheadReport, isOverheadGateEnabled, overheadFileName } from "./runner/overhead";
import { runScenario } from "./runner/runScenario";
import { getScenarioUnderTest } from "./runner/scenariosUnderTest";

// Telemetry overhead A/B (see `runner/overhead.ts`): each scenario runs with `?telemetry=off`, then
// with telemetry on, each in a freshly launched app instance (new Electron app / new Chromium
// browser, the previous one closed first), and the host process metrics are compared. Writes
// `benchmark/.artifacts/overhead-<platform>-<scenario>-<ts>.json` plus both runs' v1 results
// (`…-telemetry-off-…` for the baseline; no legacy artifacts). Report only, unless
// `BENCHMARK_OVERHEAD_GATE=1`.
//
// Screenshots are explicitly disabled here (the scenarios spec takes them): a `page.screenshot()`
// costs renderer/GPU/browser CPU and memory, and these runs exist only to compare host process
// metrics between telemetry off and on. Taking them would add noise to that A/B.

const OVERHEAD_SCENARIOS = ["sinewave", "mcap-multi-ingest"] as const;

for (const scenarioId of OVERHEAD_SCENARIOS) {
  test(`should measure the telemetry overhead of the ${scenarioId} scenario`, async ({
    platform,
    launchTarget,
    fixtureUrls,
  }) => {
    // Two full scenario runs plus app launches.
    test.setTimeout(240_000);
    const scenario = getScenarioUnderTest(scenarioId);

    // Given / When: sequential runs, each in its own app instance (closed before the next launch)
    const offTarget = await launchTarget();
    const off = await runScenario(offTarget, scenario, {
      telemetryEnabled: false,
      fixtureUrls,
      screenshots: false,
    });
    await offTarget.dispose();
    const onTarget = await launchTarget();
    const on = await runScenario(onTarget, scenario, {
      telemetryEnabled: true,
      fixtureUrls,
      screenshots: false,
    });
    await onTarget.dispose();
    writeResultV1(off);
    writeResultV1(on);
    const report = buildOverheadReport({
      platform,
      scenarioId,
      off: off.result,
      on: on.result,
    });
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const reportPath = path.join(ARTIFACTS_DIR, overheadFileName(platform, scenarioId, Date.now()));
    fs.writeFileSync(reportPath, JSON.stringify(report, undefined, 2));
    console.debug(`Wrote ${reportPath}`, report.deltas, `withinTargets=${report.withinTargets}`);

    // Then
    expect(validateResultV1(off.result)).toEqual([]);
    expect(validateResultV1(on.result)).toEqual([]);
    expect(off.result.run.telemetryEnabled).toBe(false);
    // Telemetry off: nothing is recorded in the page.
    expect(off.result.events).toHaveLength(0);
    expect(report.off.hostPolls).toBeGreaterThan(0);
    expect(report.on.hostPolls).toBeGreaterThan(0);
    if (isOverheadGateEnabled()) {
      expect(report.withinTargets).toBe(true);
    }
  });
}
