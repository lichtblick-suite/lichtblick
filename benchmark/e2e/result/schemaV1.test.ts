// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RunInfoBuilder } from "./builders/RunInfoBuilder";
import { TelemetryRecordBuilder, panelLabels } from "./builders/TelemetryRecordBuilder";
import { MIN_SLOPE_WINDOW_MS, PROCESS_METRICS } from "./constants";
import {
  BuildResultV1Input,
  HostCpuSourceV1,
  HostProcessSample,
  RunInfoV1,
  TelemetryRecord,
  TelemetrySample,
  buildResultV1,
  computeDropped,
  computeSequenceGaps,
  steadyStateFloorTs,
  summarizePhases,
  summarizePools,
  summarizeProcess,
  summarizeRenderer,
  validateResultV1,
} from "./schemaV1";
import { median, percentile } from "./stats";
import type { TelemetryEvent } from "../../../packages/suite-base/src/util/telemetry/types";

const POOL = "pipeline.hydratedSourcePool.";

function makeRun(overrides: Partial<RunInfoV1> = {}): RunInfoV1 {
  return RunInfoBuilder.run({
    scenarioId: "mcap-multi-ingest",
    pipeline: "real",
    startMonotonicTs: 1000,
    endMonotonicTs: 11_000,
    ...overrides,
  });
}

function sample(
  overrides: Partial<TelemetrySample> & Pick<TelemetrySample, "metric" | "value">,
): TelemetrySample {
  return {
    kind: "sample",
    realm: "renderer",
    sequence: 0,
    monotonicTs: 0,
    unit: "count",
    scope: "pipeline",
    metricType: "gauge",
    ...overrides,
  };
}

function event(
  overrides: Partial<TelemetryEvent> & Pick<TelemetryEvent, "name" | "phase">,
): TelemetryEvent {
  return {
    kind: "event",
    realm: "renderer",
    sequence: 0,
    monotonicTs: 0,
    scope: "pipeline",
    ...overrides,
  };
}

/** One published pool snapshot (all series share the publish timestamp). */
function poolSnapshot(
  ts: number,
  values: { acquires: number; releases: number; terminatedPins: number; activePins: number },
  extra: Record<string, number> = {},
): TelemetrySample[] {
  const realm = "worker:1";
  const labels = { poolId: "pool-1" };
  return [
    sample({
      realm,
      monotonicTs: ts,
      metric: `${POOL}activePins`,
      value: values.activePins,
      labels,
    }),
    ...(["acquires", "releases", "terminatedPins"] as const).map((name) =>
      sample({
        realm,
        monotonicTs: ts,
        metric: `${POOL}${name}`,
        value: values[name],
        metricType: "counter",
        labels,
      }),
    ),
    ...Object.entries(extra).map(([name, value]) =>
      sample({ realm, monotonicTs: ts, metric: `${POOL}${name}`, value, labels }),
    ),
  ];
}

function makeInput(overrides: Partial<BuildResultV1Input> = {}): BuildResultV1Input {
  return {
    run: makeRun(),
    pageRecords: [],
    drainedDropped: 0,
    drainRealm: "renderer",
    hostSamples: [],
    listenerDispatchSamples: [],
    ...overrides,
  };
}

/**
 * Open at 1000, layout at 1040, one Plot panel mounted at 1060; received messages published every
 * 1000 ms up to 9000 (800) and once more during teardown (10000: 900).
 */
function panelAndPipelineRecords(): TelemetryRecord[] {
  const received: Array<[number, number]> = [];
  for (let ts = 2000; ts <= 9000; ts += 1000) {
    received.push([ts, (ts - 1000) / 10]);
  }
  received.push([10_000, 900]);
  return [
    TelemetryRecordBuilder.event({ name: "datasource.open", phase: "start", monotonicTs: 1000 }),
    TelemetryRecordBuilder.event({ name: "layout.applied", monotonicTs: 1040 }),
    TelemetryRecordBuilder.panelEvent("panel.mount", "Plot!a", 1060),
    ...TelemetryRecordBuilder.counterSeries("panel.messages.delivered", [[9000, 400]], {
      scope: "panel",
      labels: panelLabels("Plot!a"),
    }),
    ...TelemetryRecordBuilder.counterSeries("pipeline.messages.received", received),
    ...TelemetryRecordBuilder.gaugeSeries("pipeline.subscribers.count", [[9000, 1]]),
  ].map((record, sequence) => ({ ...record, sequence }));
}

describe("percentile / median", () => {
  it("uses a numeric (not lexicographic) sort with nearest rank", () => {
    // Given values that sort differently as strings
    const values = [10, 9, 100, 1, 2];

    // When computing percentiles
    // Then nearest-rank values of the numerically sorted list are returned
    expect(percentile(values, 50)).toBe(9);
    expect(percentile(values, 90)).toBe(100);
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 100)).toBe(100);
    expect(median(values)).toBe(9);
  });

  it("returns undefined for empty input and averages the middle pair for even counts", () => {
    // Given / When / Then
    expect(percentile([], 50)).toBeUndefined();
    expect(median([])).toBeUndefined();
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("computeSequenceGaps", () => {
  it("counts missing sequence numbers per realm and tolerates reordering", () => {
    // Given renderer records 0..4 without 2 (out of order) and a complete worker realm
    const records: TelemetryRecord[] = [
      ...[4, 0, 3, 1].map((sequence) => sample({ sequence, metric: "m", value: 1 })),
      ...[0, 1].map((sequence) => sample({ realm: "worker:1", sequence, metric: "m", value: 1 })),
    ];

    // When
    const gaps = computeSequenceGaps(records);

    // Then
    expect(gaps).toEqual({ renderer: 1, "worker:1": 0 });
  });

  it("should ignore duplicated sequence numbers and report gaps per realm independently", () => {
    // Given worker:1 with a duplicate and a trailing gap, worker:2 with a leading gap
    const records: TelemetryRecord[] = [
      ...[0, 1, 1, 3].map((sequence) =>
        sample({ realm: "worker:1", sequence, metric: "m", value: 1 }),
      ),
      ...[2, 3].map((sequence) => sample({ realm: "worker:2", sequence, metric: "m", value: 1 })),
    ];

    // When
    const gaps = computeSequenceGaps(records);

    // Then
    expect(gaps).toEqual({ "worker:1": 1, "worker:2": 2 });
  });
});

describe("computeDropped", () => {
  it("uses the droppedRecords counters per realm and attributes the remainder to the drained realm", () => {
    // Given a worker drop counter of 3 and 5 total drained drops
    const samples = [
      sample({ metric: "telemetry.droppedRecords", value: 1, labels: { realm: "worker:1" } }),
      sample({ metric: "telemetry.droppedRecords", value: 3, labels: { realm: "worker:1" } }),
    ];

    // When
    const dropped = computeDropped(samples, 5, "renderer");

    // Then
    expect(dropped).toEqual({ "worker:1": 3, renderer: 2 });
  });

  it("should not double count worker drops reported by the worker sink and the renderer ingest counter", () => {
    // Given the worker's own droppedRecords counter (realm worker:1) and the renderer's ingest
    // counter for the same realm; the renderer's drained drop total already includes them
    const labels = { realm: "worker:1" };
    const samples = [
      sample({ realm: "worker:1", metric: "telemetry.droppedRecords", value: 4, labels }),
      sample({ realm: "renderer", metric: "telemetry.droppedRecords", value: 6, labels }),
      sample({ metric: "telemetry.droppedRecords", value: 1, labels: { realm: "renderer" } }),
    ];

    // When
    const dropped = computeDropped(samples, 7, "renderer");

    // Then
    expect(dropped).toEqual({ "worker:1": 6, renderer: 1 });
  });

  it("should ignore droppedRecords samples without a realm label and report nothing without drops", () => {
    // Given
    const samples = [sample({ metric: "telemetry.droppedRecords", value: 9 })];

    // When
    const dropped = computeDropped(samples, 0, "renderer");

    // Then
    expect(dropped).toEqual({});
  });
});

describe("summarizePools", () => {
  it("reports final counters, high water marks and a holding invariant", () => {
    // Given two consistent snapshots (second: counters only partly republished)
    const samples = [
      ...poolSnapshot(
        1000,
        { acquires: 4, releases: 1, terminatedPins: 0, activePins: 3 },
        { highWaterResidentCount: 2, highWaterActivePins: 3 },
      ),
      ...poolSnapshot(2000, { acquires: 6, releases: 5, terminatedPins: 1, activePins: 0 }),
      sample({
        realm: "worker:1",
        monotonicTs: 2000,
        metric: `${POOL}overBudgetPeriods`,
        value: 2,
        metricType: "counter",
        labels: { poolId: "pool-1" },
      }),
    ];

    // When
    const pools = summarizePools(samples);

    // Then
    expect(pools?.["worker:1/pool-1"]).toMatchObject({
      realm: "worker:1",
      poolId: "pool-1",
      acquires: 6,
      releases: 5,
      terminatedPins: 1,
      activePinsFinal: 0,
      invariantHolds: true,
      overBudgetPeriods: 2,
      evictions: 0,
      highWaterResidentCount: 2,
      highWaterActivePins: 3,
    });
  });

  it("flags a violated invariant", () => {
    // Given a snapshot where acquires - releases - terminatedPins !== activePins
    const samples = poolSnapshot(1000, {
      acquires: 4,
      releases: 1,
      terminatedPins: 0,
      activePins: 1,
    });

    // When
    const pools = summarizePools(samples);

    // Then
    expect(pools?.["worker:1/pool-1"]?.invariantHolds).toBe(false);
  });

  it("should keep pools with the same poolId in different realms apart", () => {
    // Given the same default poolId produced by two worker realms
    const counters = (realm: string, acquires: number) =>
      (["acquires", "activePins"] as const).map((name) =>
        sample({
          realm,
          monotonicTs: 1000,
          metric: `${POOL}${name}`,
          value: acquires,
          metricType: name === "acquires" ? "counter" : "gauge",
          labels: { poolId: "pool-1" },
        }),
      );
    const samples = [...counters("worker:1", 2), ...counters("worker:2", 5)];

    // When
    const pools = summarizePools(samples);

    // Then
    expect(Object.keys(pools ?? {})).toEqual(["worker:1/pool-1", "worker:2/pool-1"]);
    expect(pools?.["worker:1/pool-1"]).toMatchObject({ acquires: 2, invariantHolds: true });
    expect(pools?.["worker:2/pool-1"]).toMatchObject({ acquires: 5, invariantHolds: true });
  });

  it("should flag an invariant violated at an intermediate snapshot even if the final one holds", () => {
    // Given
    const samples = [
      ...poolSnapshot(1000, { acquires: 3, releases: 0, terminatedPins: 0, activePins: 2 }),
      ...poolSnapshot(2000, { acquires: 3, releases: 1, terminatedPins: 2, activePins: 0 }),
    ];

    // When
    const pools = summarizePools(samples);

    // Then
    expect(pools?.["worker:1/pool-1"]).toMatchObject({ activePinsFinal: 0, invariantHolds: false });
  });

  it("returns undefined without pool series", () => {
    // Given / When / Then
    expect(summarizePools([sample({ metric: "renderer.fps", value: 60 })])).toBeUndefined();
  });
});

describe("buildResultV1", () => {
  it("merges page, host and listener samples sorted by monotonicTs and summarizes them", () => {
    // Given host samples from two polls with two processes each
    const hostSamples: HostProcessSample[] = [
      { monotonicTs: 1000, pid: 1, processType: "browser", workingSetBytes: 100, cpuPercent: 10 },
      { monotonicTs: 1000, pid: 2, processType: "renderer", workingSetBytes: 300, cpuPercent: 30 },
      {
        monotonicTs: 2000,
        pid: 1,
        processType: "browser",
        workingSetBytes: 200,
        peakWorkingSetBytes: 200,
        cpuPercent: 20,
      },
      { monotonicTs: 2000, pid: 2, processType: "renderer", workingSetBytes: 600, cpuPercent: 50 },
    ];
    // And page records (renderer metrics + events)
    const pageRecords: TelemetryRecord[] = [
      sample({ sequence: 1, monotonicTs: 1500, metric: "renderer.jsHeap.usedBytes", value: 50 }),
      sample({ sequence: 2, monotonicTs: 2500, metric: "renderer.jsHeap.usedBytes", value: 70 }),
      sample({ sequence: 3, monotonicTs: 2500, metric: "renderer.fps", value: 60 }),
      sample({
        sequence: 4,
        monotonicTs: 2500,
        metric: "renderer.lateFrames",
        value: 7,
        metricType: "counter",
      }),
      event({ sequence: 0, monotonicTs: 1100, name: "datasource.open", phase: "start" }),
      event({ sequence: 5, monotonicTs: 1300, name: "datasource.open", phase: "end" }),
      event({ sequence: 6, monotonicTs: 1400, name: "datasource.firstMessage", phase: "instant" }),
      event({ sequence: 7, monotonicTs: 1600, name: "frame.firstUseful", phase: "instant" }),
      event({ sequence: 8, monotonicTs: 1200, name: "preload", phase: "start" }),
      event({ sequence: 9, monotonicTs: 1900, name: "preload", phase: "end" }),
    ];
    const listenerDispatchSamples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => ({
      monotonicTs: 1000 + value,
      value,
    }));

    // When
    const result = buildResultV1(
      makeInput({ pageRecords, hostSamples, listenerDispatchSamples, drainedDropped: 0 }),
    );

    // Then the result is valid and sorted
    expect(validateResultV1(result)).toEqual([]);
    const timestamps = result.samples.map((s) => s.monotonicTs);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
    // And host samples are converted to process-scope samples
    const hostWs = result.samples.filter((s) => s.metric === PROCESS_METRICS.workingSetBytes);
    expect(hostWs).toHaveLength(4);
    expect(hostWs[0]).toMatchObject({
      realm: "runner",
      scope: "process",
      unit: "bytes",
      labels: { processType: "browser", pid: "1" },
    });
    // And summaries are computed per poll
    expect(result.summary.process).toEqual({
      sampleCount: 2,
      peakTotalWorkingSetBytes: 800,
      meanTotalWorkingSetBytes: 600,
      medianTotalCpuPercent: 55,
      // Polls at 1 s and 2 s: (40% + 70%) / 2 over 1 s. No slope: steady window < 10 s.
      cpuSeconds: expect.closeTo(0.55, 10),
      byType: {
        browser: { peakWorkingSetBytes: 200, medianCpuPercent: 15 },
        renderer: { peakWorkingSetBytes: 600, medianCpuPercent: 40 },
      },
    });
    expect(result.summary.renderer).toEqual({
      peakJsHeapUsedBytes: 70,
      medianFps: 60,
      lateFrames: 7,
    });
    expect(result.summary.listenerDispatchDurationMs).toEqual({
      count: 10,
      p50: 5,
      p90: 9,
      max: 10,
    });
    expect(result.summary.phases).toEqual({
      origin: "datasource.open",
      openDurationMs: 200,
      firstMessageMs: 300,
      firstUsefulFrameMs: 500,
      preloadDurationMs: 700,
    });
    expect(result.summary.hydratedSourcePool).toBeUndefined();
    expect(result.events).toHaveLength(6);
    expect(result.events[0]?.name).toBe("datasource.open");
    // And the listener samples are excluded from gap detection, which finds no gaps
    expect(result.sequenceGaps).toEqual({ renderer: 0 });
  });
});

describe("summarizePhases", () => {
  it("should add layoutApplied, panelsReady and coverage relative to datasource.open", () => {
    // Given the app ready before the open request, the layout and panels applied after it
    const events = [
      TelemetryRecordBuilder.event({ name: "app.ready", monotonicTs: 900 }),
      TelemetryRecordBuilder.event({ name: "datasource.open", phase: "start", monotonicTs: 1000 }),
      TelemetryRecordBuilder.event({ name: "layout.applied", monotonicTs: 1040 }),
      TelemetryRecordBuilder.panelEvent("panel.mount", "Plot!a", 1060),
      TelemetryRecordBuilder.panelEvent("panel.mount", "RawMessages!b", 1080),
    ];

    // When
    const phases = summarizePhases(events);

    // Then React panels only: panelsReady falls back to the latest mount
    expect(phases).toEqual({
      origin: "datasource.open",
      layoutAppliedMs: 40,
      panelsReadyMs: 80,
      panelsReadyCoverage: { mounted: 2, firstRendered: 0 },
    });
  });

  it("should fall back to the app.ready origin without a datasource.open (synthetic players)", () => {
    // Given
    const events = [
      TelemetryRecordBuilder.event({ name: "app.ready", monotonicTs: 500 }),
      TelemetryRecordBuilder.event({ name: "layout.applied", monotonicTs: 530 }),
      TelemetryRecordBuilder.panelEvent("panel.mount", "3D!a", 600),
      TelemetryRecordBuilder.panelEvent("panel.firstRender", "3D!a", 1700),
      // An open end without a start never yields an open duration
      TelemetryRecordBuilder.event({ name: "datasource.open", phase: "end", monotonicTs: 900 }),
    ];

    // When
    const phases = summarizePhases(events);

    // Then
    expect(phases).toEqual({
      origin: "app.ready",
      layoutAppliedMs: 30,
      panelsReadyMs: 1200,
      panelsReadyCoverage: { mounted: 1, firstRendered: 1 },
    });
  });

  it("should report only the coverage and preload duration without any origin", () => {
    // Given no datasource.open start and no app.ready
    const events = [
      TelemetryRecordBuilder.panelEvent("panel.mount", "Plot!a", 600),
      TelemetryRecordBuilder.event({ name: "preload", phase: "start", monotonicTs: 700 }),
      TelemetryRecordBuilder.event({ name: "preload", phase: "end", monotonicTs: 750 }),
    ];

    // When / Then
    expect(summarizePhases(events)).toEqual({
      preloadDurationMs: 50,
      panelsReadyCoverage: { mounted: 1, firstRendered: 0 },
    });
    expect(summarizePhases([])).toEqual({});
  });
});

describe("buildResultV1 panels and pipeline", () => {
  it("should add summary.panels and summary.pipeline using the phases origin and window end", () => {
    // Given panel/pipeline telemetry and a sampling window ending at 9000 (teardown until 11000)
    const result = buildResultV1(
      makeInput({
        run: makeRun({ windowEndMonotonicTs: 9_000 }),
        pageRecords: panelAndPipelineRecords(),
      }),
    );

    // Then
    expect(result.summary.panels).toEqual({
      "Plot!a": {
        panelType: "Plot",
        mountedAtMs: 60,
        mounts: 1,
        messages: 400,
        messageBytes: 0,
        rangeMessages: 0,
        rangeBytes: 0,
      },
    });
    // And the rate ignores the teardown publish at 10000 (window 1000 → last publish 9000)
    expect(result.summary.pipeline).toEqual({
      messagesReceived: 900,
      rateWindowMs: 8000,
      messagesPerSec: 100,
      subscribersMax: 1,
    });
    expect(result.summary.phases).toMatchObject({ layoutAppliedMs: 40, panelsReadyMs: 60 });
  });

  it("should omit panels and pipeline without such telemetry", () => {
    // Given / When
    const result = buildResultV1(makeInput());

    // Then
    expect(result.summary.panels).toBeUndefined();
    expect(result.summary.pipeline).toBeUndefined();
  });
});

describe("validateResultV1", () => {
  it("should accept the panels, pipeline, phases and windowEnd additions (schemaVersion 1)", () => {
    // Given a result built from panel, layout and pipeline telemetry
    const result = buildResultV1(
      makeInput({
        run: makeRun({ windowEndMonotonicTs: 9_000 }),
        pageRecords: panelAndPipelineRecords(),
      }),
    );

    // When
    const errors = validateResultV1(JSON.parse(JSON.stringify(result)));

    // Then
    expect(errors).toEqual([]);
    expect(result.schemaVersion).toBe(1);
    expect(result.summary.panels).toBeDefined();
    expect(result.summary.pipeline).toBeDefined();
    expect(result.summary.phases.panelsReadyCoverage).toBeDefined();
  });

  it("should report malformed panels, pipeline and phases additions", () => {
    // Given
    const result = buildResultV1(makeInput());
    const broken = {
      ...result,
      run: { ...result.run, windowEndMonotonicTs: "late" },
      summary: {
        ...result.summary,
        phases: { origin: "frame.firstUseful", panelsReadyMs: "1", panelsReadyCoverage: 3 },
        panels: { "Plot!a": { panelType: 1, mounts: 1, messages: "9" }, "3D!b": 5 },
        pipeline: { messagesPerSec: "fast", memoryPeakBytes: { buffered: "big" } },
      },
    };

    // When
    const errors = validateResultV1(broken);

    // Then
    expect(errors).toEqual([
      "run.windowEndMonotonicTs must be a number",
      "summary.phases.panelsReadyMs must be a number",
      "summary.phases.origin must be one of datasource.open, app.ready",
      "summary.phases.panelsReadyCoverage must be an object",
      "summary.panels.Plot!a.panelType must be a string",
      "summary.panels.Plot!a.messages must be a number",
      "summary.panels.Plot!a.messageBytes is missing",
      "summary.panels.Plot!a.rangeMessages is missing",
      "summary.panels.Plot!a.rangeBytes is missing",
      "summary.panels.3D!b must be an object",
      "summary.pipeline.messagesPerSec must be a number",
      "summary.pipeline.memoryPeakBytes.buffered must be a finite number",
    ]);
  });

  it("should still accept results without the panels/pipeline additions", () => {
    // Given a result written before the additions (no origin, panels, pipeline, windowEnd)
    const result = buildResultV1(makeInput());
    const { panels: _panels, pipeline: _pipeline, ...summary } = result.summary;
    const legacy = { ...result, summary: { ...summary, phases: {} } };

    // When / Then
    expect(validateResultV1(legacy)).toEqual([]);
  });

  it("accepts a minimal empty result", () => {
    // Given
    const result = buildResultV1(makeInput());

    // When / Then
    expect(validateResultV1(result)).toEqual([]);
    expect(validateResultV1(JSON.parse(JSON.stringify(result)))).toEqual([]);
  });

  it("reports structural problems", () => {
    // Given a result with a wrong version, a bad platform, unsorted and malformed samples
    const result = buildResultV1(makeInput());
    const broken = {
      ...result,
      schemaVersion: 2,
      run: { ...result.run, platform: "android", startedAtWall: "not a date" },
      samples: [
        sample({ monotonicTs: 2, metric: "a", value: 1 }),
        { ...sample({ monotonicTs: 1, metric: "b", value: 1 }), metricType: "histogram" },
      ],
      dropped: { renderer: "x" },
    };

    // When
    const errors = validateResultV1(broken);

    // Then
    expect(errors).toEqual(
      expect.arrayContaining([
        "schemaVersion must be 1",
        'run.platform must be "electron" or "web"',
        "run.startedAtWall must be an ISO date",
        'samples[1].metricType must be "gauge" or "counter"',
        "samples must be sorted by monotonicTs",
        "dropped.renderer must be a finite number",
      ]),
    );
  });

  it("rejects non-objects", () => {
    // Given / When / Then
    expect(validateResultV1(undefined)).toEqual(["result must be an object"]);
  });

  it("should accept runnerEvents and their summary counts", () => {
    // Given a result built with runner events (unsorted input)
    const result = buildResultV1(
      makeInput({
        runnerEvents: [
          { type: "renderer.reload", monotonicTs: 3_000, url: "http://localhost/?scenario=x" },
          {
            type: "process.gone",
            monotonicTs: 2_000,
            reason: "oom",
            processType: "renderer",
            exitCode: 9,
          },
        ],
      }),
    );

    // When
    const errors = validateResultV1(JSON.parse(JSON.stringify(result)));

    // Then
    expect(errors).toEqual([]);
    expect(result.schemaVersion).toBe(1);
    expect(result.runnerEvents?.map((runnerEvent) => runnerEvent.type)).toEqual([
      "process.gone",
      "renderer.reload",
    ]);
    expect(result.summary.runnerEvents).toEqual({
      "renderer.crash": 0,
      "process.gone": 1,
      "renderer.reload": 1,
    });
  });

  it("should accept an empty runnerEvents list and results without runnerEvents", () => {
    // Given
    const checked = buildResultV1(makeInput({ runnerEvents: [] }));
    const unchecked = buildResultV1(makeInput());

    // When / Then
    expect(validateResultV1(checked)).toEqual([]);
    expect(checked.runnerEvents).toEqual([]);
    expect(checked.summary.runnerEvents).toEqual({
      "renderer.crash": 0,
      "process.gone": 0,
      "renderer.reload": 0,
    });
    expect(validateResultV1(unchecked)).toEqual([]);
    expect(unchecked.runnerEvents).toBeUndefined();
    expect(unchecked.summary.runnerEvents).toBeUndefined();
  });

  it("should report malformed runnerEvents", () => {
    // Given
    const result = buildResultV1(makeInput());
    const broken = {
      ...result,
      runnerEvents: [{ type: "renderer.hang", monotonicTs: "soon", exitCode: "9" }, 42],
    };

    // When
    const errors = validateResultV1(broken);

    // Then
    expect(errors).toEqual([
      "runnerEvents[0].type must be one of renderer.crash, process.gone, renderer.reload",
      "runnerEvents[0].monotonicTs must be a number",
      "runnerEvents[0].exitCode must be a number",
      "runnerEvents[1] must be an object",
    ]);
  });
});

describe("summarizeProcess trends", () => {
  const MIB = 1024 * 1024;

  /** One process per poll; `ws` in MiB, at `ts`. */
  function polls(series: Array<[ts: number, wsMiB: number, cpuPercent?: number]>) {
    return series.map(
      ([monotonicTs, wsMiB, cpuPercent]): HostProcessSample => ({
        monotonicTs,
        pid: 1,
        processType: "renderer",
        workingSetBytes: wsMiB * MIB,
        ...(cpuPercent != undefined && { cpuPercent }),
      }),
    );
  }

  it("should fit the total working-set slope over the steady window only (MiB/min)", () => {
    // Given: window [0, 60 s]; warm-up (< 12 s) jumps to 500 MiB, then +1 MiB every 6 s (10/min)
    const hostSamples = polls([
      [0, 100],
      [6000, 500],
      [12_000, 200],
      [18_000, 201],
      [24_000, 202],
      [30_000, 203],
    ]);

    // When
    const summary = summarizeProcess(hostSamples, { startTs: 0, endTs: 60_000 });

    // Then
    expect(summary.totalWorkingSetSlopeMiBPerMin).toBeCloseTo(10, 10);
  });

  it("should sum the processes of each poll before fitting the slope", () => {
    // Given: two processes, each +1 MiB per 6 s
    const hostSamples = [10_000, 16_000, 22_000].flatMap((monotonicTs, index) => [
      { monotonicTs, pid: 1, processType: "browser", workingSetBytes: (10 + index) * MIB },
      { monotonicTs, pid: 2, processType: "renderer", workingSetBytes: (20 + index) * MIB },
    ]);

    // When
    const summary = summarizeProcess(hostSamples, { startTs: 0, endTs: 30_000 });

    // Then
    expect(summary.totalWorkingSetSlopeMiBPerMin).toBeCloseTo(20, 10);
  });

  it("should omit the slope with fewer than 3 steady-state polls", () => {
    // Given: window [0, 60 s] -> steady from 12 s; only two polls after it
    const hostSamples = polls([
      [1000, 100],
      [13_000, 110],
      [20_000, 120],
    ]);

    // When
    const summary = summarizeProcess(hostSamples, { startTs: 0, endTs: 60_000 });

    // Then
    expect(summary).not.toHaveProperty("totalWorkingSetSlopeMiBPerMin");
  });

  it("should omit the slope when the steady window is shorter than MIN_SLOPE_WINDOW_MS", () => {
    // Given: window [0, 10 s] -> steady window [2 s, 10 s] = 8 s, with 5 polls in it
    const hostSamples = polls([
      [2000, 100],
      [4000, 110],
      [6000, 120],
      [8000, 130],
      [10_000, 140],
    ]);

    // When
    const summary = summarizeProcess(hostSamples, { startTs: 0, endTs: 10_000 });

    // Then
    expect(MIN_SLOPE_WINDOW_MS).toBe(10_000);
    expect(summary).not.toHaveProperty("totalWorkingSetSlopeMiBPerMin");
    expect(summary.cpuSeconds).toBeUndefined();
  });

  it("should start the steady window at the end of startup when it is later than the warm-up", () => {
    // Given: window [0, 60 s]; startup ramp until 30 s (> 12 s warm-up), then +1 MiB per 6 s
    const hostSamples = polls([
      [12_000, 100],
      [24_000, 400],
      [30_000, 200],
      [36_000, 201],
      [42_000, 202],
    ]);
    const measured = { startTs: 0, endTs: 60_000 };

    // When
    const withFloor = summarizeProcess(hostSamples, measured, 30_000);
    const withEarlyFloor = summarizeProcess(hostSamples, measured, 5000);

    // Then: the ramp polls are excluded only with the later floor
    expect(withFloor.totalWorkingSetSlopeMiBPerMin).toBeCloseTo(10, 10);
    expect(withEarlyFloor.totalWorkingSetSlopeMiBPerMin).not.toBeCloseTo(10, 0);
  });

  it("should omit the slope when the end of startup leaves less than MIN_SLOPE_WINDOW_MS", () => {
    // Given: window [0, 30 s]; startup ends at 25 s -> 5 s left
    const hostSamples = polls([
      [25_000, 100],
      [27_000, 101],
      [29_000, 102],
    ]);

    // When
    const summary = summarizeProcess(hostSamples, { startTs: 0, endTs: 30_000 }, 25_000);

    // Then
    expect(summary).not.toHaveProperty("totalWorkingSetSlopeMiBPerMin");
  });

  it("should integrate total CPU over the polls of the window in seconds", () => {
    // Given: 100% for 2 s, then 200% for 1 s (outside-window poll ignored)
    const hostSamples = polls([
      [0, 1, 100],
      [1000, 1, 100],
      [2000, 1, 100],
      [3000, 1, 200],
      [4000, 1, 200],
      [9000, 1, 900],
    ]);

    // When
    const summary = summarizeProcess(hostSamples, { startTs: 0, endTs: 4000 });

    // Then: 1 + 1 + 1.5 + 2
    expect(summary.cpuSeconds).toBeCloseTo(5.5, 10);
  });

  it("should omit CPU time with fewer than 2 CPU polls and use the polls without a window", () => {
    // Given
    const single = polls([[0, 1, 50]]);
    const unbounded = polls([
      [0, 10, 100],
      [60_000, 20, 100],
      [120_000, 30, 100],
      [180_000, 40, 100],
    ]);

    // When
    const singleSummary = summarizeProcess(single);
    const unboundedSummary = summarizeProcess(unbounded);

    // Then: steady window = [36 s, 180 s] -> polls at 60, 120, 180 s
    expect(singleSummary).not.toHaveProperty("cpuSeconds");
    expect(unboundedSummary.cpuSeconds).toBeCloseTo(180, 10);
    expect(unboundedSummary.totalWorkingSetSlopeMiBPerMin).toBeCloseTo(10, 10);
  });
});

describe("steadyStateFloorTs", () => {
  it("should return the later of panels ready and first message on the page clock", () => {
    // Given / When / Then
    expect(steadyStateFloorTs({ panelsReadyMs: 800, firstMessageMs: 300 }, 1000)).toBe(1800);
    expect(steadyStateFloorTs({ firstMessageMs: 300 }, 1000)).toBe(1300);
  });

  it("should be undefined without an origin or without both phases", () => {
    // Given / When / Then
    expect(steadyStateFloorTs({ panelsReadyMs: 800 }, undefined)).toBeUndefined();
    expect(steadyStateFloorTs({}, 1000)).toBeUndefined();
  });
});

describe("summarizeRenderer frame and long-task totals", () => {
  it("should report the cumulative frame count and long-task duration", () => {
    // Given
    const counter = (monotonicTs: number, metric: string, value: number) =>
      sample({ realm: "renderer", monotonicTs, metric, value, metricType: "counter" });
    const samples = [
      counter(1000, "renderer.frames", 60),
      counter(2000, "renderer.frames", 119),
      counter(1000, "renderer.longTasks.count", 1),
      counter(1000, "renderer.longTasks.durationMs", 80),
      counter(2000, "renderer.longTasks.durationMs", 230),
    ];

    // When
    const summary = summarizeRenderer(samples);

    // Then
    expect(summary).toEqual({ totalFrames: 119, longTasks: 1, longTaskTotalMs: 230 });
  });

  it("should omit the totals without renderer telemetry", () => {
    // Given / When / Then
    expect(summarizeRenderer([])).toEqual({});
  });
});

describe("validateResultV1 run.scenario and render calibration", () => {
  function withRun(run: Record<string, unknown>): unknown {
    return { ...buildResultV1(makeInput()), run };
  }

  it("should require run.scenario, logicalCpus and the calibration in strict mode only", () => {
    // Given an older result without run.scenario, logicalCpus and calibration
    const { scenario: _scenario, environment, ...run } = makeRun();
    const {
      logicalCpus: _cpus,
      fpsCeiling: _fps,
      glRenderer: _gl,
      lateFrameThresholdMs: _late,
      ...host
    } = environment;
    const legacy = withRun({ ...run, environment: host });

    // When
    const strictErrors = validateResultV1(legacy);
    const lenientErrors = validateResultV1(legacy, "lenient");

    // Then
    expect(strictErrors).toEqual([
      "run.environment.logicalCpus is missing",
      "run.environment.fpsCeiling is missing",
      "run.environment.glRenderer is missing",
      "run.environment.lateFrameThresholdMs is missing",
      "run.scenario is missing",
    ]);
    expect(lenientErrors).toEqual([]);
  });

  it("should check the shape of run.scenario and the calibration in both modes", () => {
    // Given
    const run = makeRun();
    const broken = withRun({
      ...run,
      environment: { ...run.environment, logicalCpus: "8", fpsCeiling: "60", glRenderer: 1 },
      scenario: {
        scenarioId: "other",
        description: "d",
        group: "rendering",
        layout: "l",
        player: 3,
        dataSource: "sinewave",
        tags: ["a", 1],
        params: { url: 5 },
        panels: [{ id: "Plot!a" }, "3D!b"],
      },
    });

    // When
    const strictErrors = validateResultV1(broken);
    const lenientErrors = validateResultV1(broken, "lenient");

    // Then
    const expected = [
      "run.environment.logicalCpus must be a number",
      "run.environment.fpsCeiling must be a number",
      "run.environment.glRenderer must be a string",
      "run.scenario.player must be a string",
      "run.scenario.scenarioId must equal run.scenarioId",
      "run.scenario.group must be one of 3d-rendering, time-series, preloading, real-pipeline-ingest",
      "run.scenario.dataSource must be an object",
      "run.scenario.tags must contain only strings",
      "run.scenario.params.url must be a string",
      "run.scenario.panels[0].type is missing",
      "run.scenario.panels[1] must be an object",
    ];
    expect(strictErrors).toEqual(expected);
    expect(lenientErrors).toEqual(expected);
  });

  it("should reject a non-object run.scenario", () => {
    // Given
    const broken = withRun({ ...makeRun(), scenario: "sinewave" });

    // When / Then
    expect(validateResultV1(broken, "lenient")).toEqual(["run.scenario must be an object"]);
  });

  it("should accept the new optional summary fields and reject malformed ones", () => {
    // Given
    const result = buildResultV1(makeInput());
    const valid = {
      ...result,
      summary: {
        ...result.summary,
        process: { ...result.summary.process, totalWorkingSetSlopeMiBPerMin: -1.5, cpuSeconds: 3 },
        renderer: { totalFrames: 600, longTaskTotalMs: 120 },
      },
    };
    const broken = {
      ...valid,
      summary: {
        ...valid.summary,
        process: { ...valid.summary.process, cpuSeconds: "3" },
        renderer: { totalFrames: "600" },
      },
    };

    // When / Then
    expect(validateResultV1(valid)).toEqual([]);
    expect(validateResultV1(broken)).toEqual([
      "summary.process.cpuSeconds must be a number",
      "summary.renderer.totalFrames must be a number",
    ]);
  });
});

describe("summary.kpis", () => {
  it("should be written by buildResultV1 and pass strict validation", () => {
    // Given / When
    const result = buildResultV1(makeInput());

    // Then
    expect(result.summary.kpis.stability).toEqual({ healthy: true, reasons: [] });
    expect(result.summary.kpis).not.toHaveProperty("recomputed");
    expect(validateResultV1(result)).toEqual([]);
  });

  it("should be required in strict mode only", () => {
    // Given an older result without summary.kpis
    const result = buildResultV1(makeInput());
    const { kpis: _kpis, ...summary } = result.summary;
    const legacy = { ...result, summary };

    // When / Then
    expect(validateResultV1(legacy)).toEqual(["summary.kpis is missing"]);
    expect(validateResultV1(legacy, "lenient")).toEqual([]);
  });

  it("should reject malformed KPI families in both modes", () => {
    // Given
    const result = buildResultV1(makeInput());
    const broken = {
      ...result,
      summary: {
        ...result.summary,
        kpis: {
          ...result.summary.kpis,
          memory: 3,
          stability: { healthy: "yes", reasons: [1] },
          smoothness: {},
          renderCost: { p90RenderMsByPanelType: { "3D": "slow" } },
        },
      },
    };
    const expected = [
      "summary.kpis.memory must be an object",
      "summary.kpis.stability.healthy must be a boolean",
      "summary.kpis.stability.reasons must contain only strings",
      "summary.kpis.smoothness.lowFps is missing",
      "summary.kpis.renderCost.p90RenderMsByPanelType.3D must be a finite number",
    ];

    // When / Then
    expect(validateResultV1(broken)).toEqual(expected);
    expect(validateResultV1(broken, "lenient")).toEqual(expected);
  });
});

describe("validateResultV1 run.mode and webBrowser", () => {
  function withMode(mode: string | undefined): Record<string, unknown> {
    const result = buildResultV1(makeInput());
    const { mode: _mode, ...run } = result.run;
    return { ...result, run: mode == undefined ? run : { ...run, mode } };
  }

  it("should accept a scenario run", () => {
    // Given
    const scenario = withMode("scenario");

    // When
    const errors = validateResultV1(scenario);

    // Then
    expect(errors).toEqual([]);
  });

  it("should require run.mode in strict mode only", () => {
    // Given a result written before run.mode
    const older = withMode(undefined);

    // When
    const strictErrors = validateResultV1(older);
    const lenientErrors = validateResultV1(older, "lenient");

    // Then
    expect(strictErrors).toEqual(["run.mode must be one of scenario"]);
    expect(lenientErrors).toEqual([]);
  });

  it("should reject an unknown run.mode in both modes", () => {
    // Given
    const unknown = withMode("benchmark");

    // When / Then
    expect(validateResultV1(unknown)).toContain("run.mode must be one of scenario");
    expect(validateResultV1(unknown, "lenient")).toEqual(["run.mode must be one of scenario"]);
  });

  it("should accept a known run.environment.webBrowser and reject others", () => {
    // Given
    const result = buildResultV1(makeInput());
    const withBrowser = (webBrowser: string) => ({
      ...result,
      run: { ...result.run, environment: { ...result.run.environment, webBrowser } },
    });

    // When / Then
    expect(validateResultV1(withBrowser("chromium"))).toEqual([]);
    expect(validateResultV1(withBrowser("chromium-headless-shell"))).toEqual([]);
    expect(validateResultV1(withBrowser("firefox"), "lenient")).toEqual([
      "run.environment.webBrowser must be one of chromium-headless-shell, chromium",
    ]);
  });
});

describe("host CPU source", () => {
  const hostSamples: HostProcessSample[] = [
    { monotonicTs: 1000, pid: 1, processType: "browser", workingSetBytes: 100, cpuPercent: 10 },
    { monotonicTs: 2000, pid: 1, processType: "browser", workingSetBytes: 200, cpuPercent: 30 },
    { monotonicTs: 3000, pid: 1, processType: "browser", workingSetBytes: 300 },
  ];

  function runWithSource(hostCpuSource: HostCpuSourceV1 | undefined): RunInfoV1 {
    const run = makeRun();
    return { ...run, environment: { ...run.environment, hostCpuSource } };
  }

  it("should summarize the interval CPU when the source is cdp", () => {
    // Given
    const input = makeInput({ run: runWithSource("cdp"), hostSamples });

    // When
    const result = buildResultV1(input);

    // Then
    expect(result.summary.process.medianTotalCpuPercent).toBe(20);
  });

  it("should leave the CPU summary and KPIs empty when the collector fell back to ps", () => {
    // Given interval CPU from polls before the fallback, then memory-only ps polls
    const input = makeInput({ run: runWithSource("ps"), hostSamples });

    // When
    const result = buildResultV1(input);

    // Then
    expect({
      median: result.summary.process.medianTotalCpuPercent,
      browser: result.summary.process.byType.browser?.medianCpuPercent,
      cpuSeconds: result.summary.process.cpuSeconds,
      kpi: result.summary.kpis.cpu.medianCpuPercent,
      sampleCount: result.summary.process.sampleCount,
    }).toEqual({
      median: undefined,
      browser: undefined,
      cpuSeconds: undefined,
      kpi: undefined,
      sampleCount: 3,
    });
  });

  it("should omit medianTotalCpuPercent instead of reporting 0 without CPU readings", () => {
    // Given memory-only polls
    const memoryOnly = hostSamples.map(({ cpuPercent: _cpuPercent, ...rest }) => rest);

    // When
    const summary = summarizeProcess(memoryOnly);

    // Then
    expect(summary.medianTotalCpuPercent).toBeUndefined();
  });

  it("should accept a result without CPU summary built from the ps fallback", () => {
    // Given
    const result = buildResultV1(makeInput({ run: runWithSource("ps"), hostSamples }));

    // When
    const errors = validateResultV1(JSON.parse(JSON.stringify(result)));

    // Then
    expect(errors).toEqual([]);
  });

  it("should reject an unknown run.environment.hostCpuSource in both modes", () => {
    // Given
    const result = buildResultV1(makeInput());
    const unknown = {
      ...result,
      run: { ...result.run, environment: { ...result.run.environment, hostCpuSource: "top" } },
    };

    // When
    const lenientErrors = validateResultV1(unknown, "lenient");

    // Then
    expect(lenientErrors).toEqual([
      "run.environment.hostCpuSource must be one of cdp, app-metrics, ps",
    ]);
  });
});
