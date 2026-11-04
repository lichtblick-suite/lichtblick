// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RunInfoBuilder } from "./builders/RunInfoBuilder";
import { TelemetryRecordBuilder } from "./builders/TelemetryRecordBuilder";
import {
  EXERCISED_COMPONENT_PREFIXES,
  PIPELINE_MEMORY_METRIC_PREFIX,
  PIPELINE_METRICS,
  POOL_METRIC_PREFIX,
  POOL_METRICS,
} from "./constants";
import { exercisedComponents } from "./exercised";
import type { ExercisedComponentsInput } from "./exercised.types";
import type { PanelSummaryV1, TelemetrySample } from "./schemaV1";

function panel(panelType: string): PanelSummaryV1 {
  return {
    panelType,
    mounts: 1,
    messages: 0,
    messageBytes: 0,
    rangeMessages: 0,
    rangeBytes: 0,
  };
}

function input({
  metrics = [],
  panels,
  scenario = RunInfoBuilder.scenario("sinewave"),
}: {
  metrics?: string[];
  panels?: Record<string, PanelSummaryV1>;
  scenario?: ExercisedComponentsInput["run"]["scenario"];
}): ExercisedComponentsInput {
  const samples: TelemetrySample[] = metrics.map((metric) =>
    TelemetryRecordBuilder.sample({ metric, value: 1 }),
  );
  return {
    run: { scenario },
    samples,
    summary: {
      process: {
        sampleCount: 0,
        peakTotalWorkingSetBytes: 0,
        meanTotalWorkingSetBytes: 0,
        medianTotalCpuPercent: 0,
        byType: {},
      },
      renderer: {},
      phases: {},
      ...(panels != undefined && { panels }),
    },
  };
}

describe("exercisedComponents", () => {
  it("should map pipeline metric prefixes to sorted, unique components", () => {
    // Given
    const metrics = [
      "pipeline.remote.bytesRead",
      "pipeline.messages.received",
      "pipeline.hydratedSourcePool.acquires",
      "pipeline.memory.bytes",
      "pipeline.sources.total",
      "pipeline.blockCache.bytes",
      "pipeline.sourceCache.hits",
      "pipeline.subscribers.count",
      "pipeline.listenerDispatchDurationMs.max",
      "pipeline.messages.received",
      "renderer.fps",
      "process.workingSetBytes",
      "pipeline.unknown.metric",
    ];

    // When
    const result = exercisedComponents(input({ metrics }));

    // Then
    expect(result.pipelineComponents).toEqual([
      "BlockLoader",
      "CachingIterableSource",
      "HydratedSourcePool",
      "IterablePlayer (memoryInfo)",
      "MessagePipeline",
      "MultiIterableSource",
      "RemoteFileReadable",
    ]);
  });

  it("should map every known pipeline, pool and memory metric to a component", () => {
    // Given
    const metrics = [
      ...Object.values(PIPELINE_METRICS),
      ...Object.values(POOL_METRICS),
      `${PIPELINE_MEMORY_METRIC_PREFIX}total`,
      `${POOL_METRIC_PREFIX}anything`,
    ];

    // When
    const unmapped = metrics.filter(
      (metric) => exercisedComponents(input({ metrics: [metric] })).pipelineComponents.length !== 1,
    );

    // Then
    expect(unmapped).toEqual([]);
    expect(EXERCISED_COMPONENT_PREFIXES.length).toBeGreaterThan(0);
  });

  it("should count panel types with telemetry and list declared panels without it", () => {
    // Given
    const scenario = RunInfoBuilder.scenario("transformpreloading", {
      panels: [
        { id: "RawMessages!41teyny", type: "RawMessages" },
        { id: "3D!2cny167", type: "3D" },
        { id: "3D!b", type: "3D" },
        { id: "3D!a", type: "3D" },
      ],
    });
    const panels = {
      "RawMessages!41teyny": panel("RawMessages"),
      "3D!2cny167": panel("3D"),
      "Plot!x": panel("Plot"),
      "3D!c": panel("3D"),
    };

    // When
    const result = exercisedComponents(input({ panels, scenario }));

    // Then
    expect(result.panelTypes).toEqual([
      { type: "3D", count: 2 },
      { type: "Plot", count: 1 },
      { type: "RawMessages", count: 1 },
    ]);
    expect(result.panelsDeclaredWithoutTelemetry).toEqual(["3D!a", "3D!b"]);
  });

  it("should list every declared panel when the run has no panel telemetry", () => {
    // Given / When
    const result = exercisedComponents(input({}));

    // Then
    expect(result).toEqual({
      pipelineComponents: [],
      panelTypes: [],
      panelsDeclaredWithoutTelemetry: ["Plot!a"],
    });
  });

  it("should not report declared panels for results without run.scenario", () => {
    // Given
    const legacy = input({ panels: { "Plot!a": panel("Plot") }, scenario: undefined });

    // When
    const result = exercisedComponents(legacy);

    // Then
    expect(result.panelsDeclaredWithoutTelemetry).toEqual([]);
    expect(result.panelTypes).toEqual([{ type: "Plot", count: 1 }]);
  });
});
