// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TelemetryRecordBuilder, panelLabels } from "../../result/builders/TelemetryRecordBuilder";
import { PANEL_METRICS, PIPELINE_METRICS } from "../../result/constants";
import { BenchmarkResultV1, buildResultV1 } from "../../result/schemaV1";
import type { TelemetryEvent, TelemetryRecord } from "../../result/schemaV1";
import { buildOverheadReport } from "../../runner/overhead";
import type { OverheadReport } from "../../runner/types";
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
    return buildResultV1({
      run: {
        scenarioId: props.scenarioId ?? "sinewave",
        pipeline: "synthetic",
        platform: props.platform ?? "electron",
        telemetryEnabled: props.telemetryEnabled ?? true,
        startedAtWall: "2026-01-01T00:00:00.000Z",
        finishedAtWall: props.finishedAtWall ?? "2026-01-01T00:00:05.000Z",
        startMonotonicTs: 0,
        endMonotonicTs: 5000,
        sampleIntervalMs: 1000,
        environment: {
          os: "darwin",
          arch: "arm64",
          ci: false,
          cpuModel: "cpu",
          totalMemBytes: 8 * 1024 ** 3,
        },
      },
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
  }

  /** A result as loaded from its artifact file (`<scenario>-<platform>[-telemetry-off]-<ts>`). */
  public static loaded(props: ResultProps & { ts?: number } = {}): LoadedResult {
    const result = BenchmarkResultBuilder.result(props);
    const off = result.run.telemetryEnabled ? "" : "-telemetry-off";
    const { scenarioId, platform } = result.run;
    return {
      fileName: `${scenarioId}-${platform}${off}-${props.ts ?? 1}.benchmark-result.v1.json`,
      result,
    };
  }

  /** Overhead A/B report of a scenario (telemetry off vs on). */
  public static overhead(
    props: {
      scenarioId?: string;
      platform?: "electron" | "web";
      createdAtWall?: string;
      memDeltaBytes?: number;
      cpuOn?: number;
    } = {},
  ): OverheadReport {
    const scenarioId = props.scenarioId ?? "sinewave";
    const platform = props.platform ?? "electron";
    return buildOverheadReport({
      platform,
      scenarioId,
      off: BenchmarkResultBuilder.result({ scenarioId, platform, telemetryEnabled: false }),
      on: BenchmarkResultBuilder.result({
        scenarioId,
        platform,
        workingSetBytes: 100 * MIB + (props.memDeltaBytes ?? 0),
        cpuPercent: props.cpuOn ?? 10,
      }),
      now: new Date(props.createdAtWall ?? "2026-01-01T00:00:00.000Z"),
    });
  }
}
