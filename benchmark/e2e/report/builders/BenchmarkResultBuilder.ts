// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { TelemetryEvent } from "../../../../packages/suite-base/src/util/telemetry/types";
import { RunInfoBuilder } from "../../result/builders/RunInfoBuilder";
import { TelemetryRecordBuilder, panelLabels } from "../../result/builders/TelemetryRecordBuilder";
import { PANEL_METRICS, PIPELINE_METRICS } from "../../result/constants";
import type { DirectAttributionV3 } from "../../result/directAttribution.types";
import { BenchmarkResultV1, PersistedResultV1, buildResultV1 } from "../../result/schemaV1";
import type { TelemetryRecord } from "../../result/schemaV1";
import type { RunModeV1 } from "../../result/schemaV1.types";
import { OverheadRunBuilder } from "../../runner/builders/OverheadRunBuilder";
import { ToggleBlockBuilder } from "../../runner/builders/ToggleBlockBuilder";
import { buildOverheadReport } from "../../runner/overhead";
import type { OverheadMethod, OverheadReport } from "../../runner/overhead.types";
import type { OverheadToggleSummaryV3 } from "../../runner/toggleBlocks.types";
import type { LoadedResult } from "../types";

const MIB = 1024 * 1024;

export type ResultProps = {
  scenarioId?: string;
  platform?: "electron" | "web";
  telemetryEnabled?: boolean;
  finishedAtWall?: string;
  /** Working set of the browser process (overhead A/B inputs). */
  workingSetBytes?: number;
  cpuPercent?: number;
  /** `overhead`: a run of the overhead A/B (`run.mode` plus a `summary.steadyWindow`). */
  mode?: RunModeV1;
};

function event(
  name: string,
  monotonicTs: number,
  extra: Partial<TelemetryEvent> = {},
): TelemetryEvent {
  return {
    kind: "event",
    realm: "renderer",
    sequence: 0,
    monotonicTs,
    name,
    phase: "instant",
    scope: "app",
    ...extra,
  } as TelemetryEvent;
}

/**
 * Small but complete `benchmark-result.v1` results (host memory, renderer heap, pipeline counters,
 * one adapter panel with render observations, phase events) for the HTML viewer tests.
 */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BenchmarkResultBuilder {
  public static result(props: ResultProps = {}): BenchmarkResultV1 {
    const panel = { scope: "panel" as const, labels: panelLabels("3D!a") };
    const pageRecords: TelemetryRecord[] = [
      event("app.ready", 100),
      event("layout.applied", 200),
      event("datasource.open", 1000, { phase: "start", scope: "pipeline" }),
      event("datasource.firstMessage", 1200, { scope: "pipeline" }),
      event("panel.mount", 900, panel),
      event("panel.firstRender", 1500, panel),
      ...TelemetryRecordBuilder.counterSeries(PIPELINE_METRICS.messagesReceived, [
        [2000, 100],
        [3000, 300],
        [4000, 600],
      ]),
      ...TelemetryRecordBuilder.counterSeries(
        PIPELINE_METRICS.messagesReceivedBytes,
        [
          [2000, MIB],
          [3000, 3 * MIB],
          [4000, 6 * MIB],
        ],
        { unit: "bytes" },
      ),
      ...TelemetryRecordBuilder.gaugeSeries(
        "renderer.jsHeap.usedBytes",
        [
          [2000, 50 * MIB],
          [3000, 60 * MIB],
        ],
        { unit: "bytes", scope: "app" },
      ),
      ...TelemetryRecordBuilder.counterSeries(
        PANEL_METRICS.messagesDelivered,
        [
          [2000, 10],
          [3000, 30],
        ],
        panel,
      ),
      ...TelemetryRecordBuilder.observationSeries(
        PANEL_METRICS.renderDurationMs,
        [
          [2000, 2, 4, 3],
          [3000, 4, 20, 9],
        ],
        { ...panel, unit: "ms" },
      ),
    ];
    const result = buildResultV1({
      run: RunInfoBuilder.run({
        mode: props.mode ?? "scenario",
        scenarioId: props.scenarioId ?? "sinewave",
        pipeline: "synthetic",
        platform: props.platform ?? "electron",
        telemetryEnabled: props.telemetryEnabled ?? true,
        startedAtWall: "2026-01-01T00:00:00.000Z",
        finishedAtWall: props.finishedAtWall ?? "2026-01-01T00:00:05.000Z",
        startMonotonicTs: 0,
        endMonotonicTs: 5000,
        environment: {
          os: "darwin",
          arch: "arm64",
          ci: false,
          totalMemBytes: 8 * 1024 ** 3,
        },
      }),
      pageRecords: props.telemetryEnabled === false ? [] : pageRecords,
      drainedDropped: 0,
      drainRealm: "renderer",
      hostSamples: [1000, 2000, 3000].flatMap((monotonicTs) => [
        {
          monotonicTs,
          pid: 1,
          processType: "Browser",
          workingSetBytes: props.workingSetBytes ?? 100 * MIB,
          cpuPercent: props.cpuPercent ?? 10,
        },
        { monotonicTs, pid: 2, processType: "Tab", workingSetBytes: 200 * MIB, cpuPercent: 20 },
      ]),
      listenerDispatchSamples: [],
    });
    return props.mode === "overhead"
      ? { ...result, summary: { ...result.summary, steadyWindow: OverheadRunBuilder.steady({}) } }
      : result;
  }

  /**
   * A result written before `run.scenario`, `run.mode`, `run.environment.logicalCpus` and the render
   * calibration existed (only the lenient validation accepts it).
   */
  public static legacy(props: ResultProps = {}): PersistedResultV1 {
    const { run, ...body } = BenchmarkResultBuilder.result(props);
    const { scenario: _scenario, mode: _mode, environment, ...legacyRun } = run;
    const {
      logicalCpus: _logicalCpus,
      fpsCeiling: _fpsCeiling,
      glRenderer: _glRenderer,
      lateFrameThresholdMs: _lateFrameThresholdMs,
      ...legacyEnvironment
    } = environment;
    return { ...body, run: { ...legacyRun, environment: legacyEnvironment } };
  }

  /**
   * A result as loaded from its artifact file
   * (`<scenario>-<platform>[-telemetry-off][-overhead]-<ts>`).
   */
  public static loaded(props: ResultProps & { ts?: number } = {}): LoadedResult {
    const result = BenchmarkResultBuilder.result(props);
    const off = result.run.telemetryEnabled ? "" : "-telemetry-off";
    const overhead = props.mode === "overhead" ? "-overhead" : "";
    const { scenarioId, platform } = result.run;
    return {
      fileName: `${scenarioId}-${platform}${off}${overhead}-${props.ts ?? 1}.benchmark-result.v1.json`,
      result,
    };
  }

  /**
   * Overhead A/B report of a scenario: `repeats` ABBA pairs (default 5) with constant deltas, so the
   * CI95 collapses on them (off: 100 % CPU, 500 MiB).
   */
  public static overhead(
    props: {
      scenarioId?: string;
      platform?: "electron" | "web";
      createdAtWall?: string;
      memDeltaBytes?: number;
      /** Telemetry-on CPU, percent (off: 100). */
      cpuOn?: number;
      repeats?: number;
      telemetrySelf?: boolean;
      /** Default `relaunch`; `toggle` / `both` add `toggle` (default `ToggleBlockBuilder.summary()`). */
      method?: OverheadMethod;
      toggle?: OverheadToggleSummaryV3;
      /** Toggle A/B without the UA memory probe (methods `toggle` / `both` only). */
      toggleWithoutUaProbe?: OverheadToggleSummaryV3;
      /** Frame-probe toggle A/B (methods `toggle` / `both` only). */
      toggleFrameProbe?: OverheadToggleSummaryV3;
      /** Direct CPU attribution (methods `toggle` / `both` only). */
      directAttribution?: DirectAttributionV3;
    } = {},
  ): OverheadReport {
    const method = props.method ?? "relaunch";
    const repeats = method === "toggle" ? 0 : (props.repeats ?? 5);
    const on = {
      cpu: props.cpuOn ?? 101,
      wsBytes: 500 * MIB + (props.memDeltaBytes ?? 5 * MIB),
      mainThread: { longTaskBlockedMsPerSec: 2, fps: 59 },
      collectors: { uaMemory: "unsupported" as const },
      ...(props.telemetrySelf !== false && { telemetrySelf: OverheadRunBuilder.telemetrySelf() }),
    };
    const off = { mainThread: { longTaskBlockedMsPerSec: 1, fps: 60 } };
    return buildOverheadReport({
      platform: props.platform ?? "electron",
      scenarioId: props.scenarioId ?? "sinewave",
      runs: OverheadRunBuilder.abba(Array.from({ length: repeats }, () => ({ off, on }))),
      config: OverheadRunBuilder.config({ repeats }),
      now: new Date(props.createdAtWall ?? "2026-01-01T00:00:00.000Z"),
      method,
      ...(method !== "relaunch" && { toggle: props.toggle ?? ToggleBlockBuilder.summary() }),
      ...(props.toggleWithoutUaProbe != undefined && {
        toggleWithoutUaProbe: props.toggleWithoutUaProbe,
      }),
      ...(props.toggleFrameProbe != undefined && { toggleFrameProbe: props.toggleFrameProbe }),
      ...(props.directAttribution != undefined && { directAttribution: props.directAttribution }),
    });
  }
}
