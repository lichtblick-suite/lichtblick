// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { test, expect } from "./fixtures/benchmark";
import { PROCESS_METRICS } from "./result/constants";
import { validateResultV1 } from "./result/schemaV1";
import { writeScenarioArtifacts } from "./runner/artifacts";
import { runScenario } from "./runner/runScenario";
import { SCENARIOS_UNDER_TEST } from "./runner/scenariosUnderTest";

// One test per scenario and platform (Playwright project `electron`): runs the scenario
// through the shared runner core and writes the legacy artifact plus `benchmark-result.v1.json`
// to `benchmark/.artifacts`, plus checkpoint screenshots to `benchmark/.artifacts/screenshots`
// (also attached to the Playwright report): by default only `end`, taken after all measurement so
// no metric is affected; `BENCHMARK_SCREENSHOTS=all` adds `loaded`/`mid` (visual debugging,
// distorts metrics), `=0` disables. Screenshot failures never fail a test; a panel error boundary
// does (`runner/errorBoundaries.ts`).

for (const scenario of SCENARIOS_UNDER_TEST) {
  test(`should run the ${scenario.scenarioId} ${scenario.pipeline}-pipeline scenario and collect memory/frame-time samples`, async ({
    target,
  }, testInfo) => {
    // Given / When
    const run = await runScenario(target, scenario, {
      screenshots: true,
      testInfo,
    });
    const paths = writeScenarioArtifacts(run);
    console.debug(`Wrote ${paths.legacyPath} and ${paths.resultPath}`);
    for (const screenshot of run.screenshots) {
      console.debug(`Wrote ${screenshot.checkpoint} screenshot ${screenshot.path}`);
    }

    // Then: legacy artifact
    expect(run.legacy.memorySamples.length).toBeGreaterThan(0);

    // And: v1 result
    const { result } = run;
    expect(validateResultV1(result)).toEqual([]);
    expect(result.run.mode).toBe("scenario");
    const hostSamples = result.samples.filter(
      (sample) => sample.scope === "process" && sample.metric === PROCESS_METRICS.workingSetBytes,
    );
    expect(hostSamples.length).toBeGreaterThan(0);
    expect(result.summary.process.peakTotalWorkingSetBytes).toBeGreaterThan(0);

    // And: the page described the scenario it ran, and the render environment was calibrated
    expect(result.run.scenario.scenarioId).toBe(scenario.scenarioId);
    expect(result.run.scenario.panels.length).toBeGreaterThan(0);
    expect(result.run.environment.fpsCeiling).toBeGreaterThan(0);
    expect(result.run.environment.glRenderer).not.toBe("");

    // And: panel, layout and pipeline telemetry (sink installed before the layout/panels mount)
    if (result.run.telemetryEnabled) {
      const eventNames = new Set(result.events.map((event) => event.name));
      expect(eventNames).toContain("layout.applied");
      expect(eventNames).toContain("panel.mount");
      const mountedPanelIds = new Set(
        result.events
          .filter((event) => event.name === "panel.mount")
          .map((event) => event.labels?.panelId),
      );
      // Order-insensitive: `arrayContaining` matches the elements in any order.
      expect(Object.keys(result.summary.panels ?? {})).toEqual(
        expect.arrayContaining([...mountedPanelIds]),
      );
      expect(result.summary.pipeline).toBeDefined();
      expect(result.summary.pipeline?.listenerDispatchMeanMs).toBeDefined();
      expect(result.summary.phases.panelsReadyMs).toBeDefined();
      // Adapter panels (those emitting `panel.firstRender`) publish render observations.
      for (const panel of Object.values(result.summary.panels ?? {})) {
        if (panel.firstRenderMs != undefined) {
          expect(panel.renderMeanMs).toBeDefined();
          expect(panel.renderMaxMs).toBeDefined();
        }
      }
    }
  });
}
