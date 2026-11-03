// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import type { OverheadPageState, OverheadResultFields } from "./overheadPage.types";
import type { LichtblickTelemetryWindow } from "../../src/telemetry/types";
import type { BenchmarkResultV1 } from "../result/schemaV1";
import { summarizeSteadyWindow } from "../result/steadyWindow";
import { summarizeTelemetrySelf } from "../result/telemetrySelf";

/**
 * Overhead A/B page state, read after the final drain (nothing below is measured):
 * `collectorsState()` in every arm, and with telemetry on the emit micro-benchmark
 * `measureEmitCost()` (blocks the main thread briefly; its throwaway sink leaves the live one
 * untouched). Page calls that fail (older page builds) are omitted.
 */
export async function readOverheadPageState(
  page: Page,
  { telemetryEnabled }: { telemetryEnabled: boolean },
): Promise<OverheadPageState> {
  const collectors = await page
    .evaluate(() => (window as LichtblickTelemetryWindow).lichtblickTelemetry?.collectorsState())
    .catch(() => undefined);
  const emitCostNs = telemetryEnabled
    ? await page
        .evaluate(() =>
          (window as LichtblickTelemetryWindow).lichtblickTelemetry?.measureEmitCost(),
        )
        .catch(() => undefined)
    : undefined;
  return {
    ...(collectors != undefined && { collectors: { uaMemory: collectors.uaMemory } }),
    ...(emitCostNs != undefined && { emitCostNs: { ...emitCostNs } }),
  };
}

/**
 * Adds the overhead A/B fields to a v1 result: `summary.steadyWindow`, `run.environment.collectors`
 * and, with telemetry on, `summary.telemetrySelf` (all optional in the schema).
 */
export function withOverheadFields(
  result: BenchmarkResultV1,
  { recording, measurement, pageState, hostSamples, pageRecords }: OverheadResultFields,
): BenchmarkResultV1 {
  const steadyWindow = summarizeSteadyWindow({
    ...recording,
    hostSamples,
    requestedPolls: measurement.polls,
    warmupMs: measurement.warmupMs,
  });
  const telemetrySelf = result.run.telemetryEnabled
    ? summarizeTelemetrySelf({
        pageRecords,
        startMonotonicTs: recording.startMonotonicTs,
        endMonotonicTs: recording.endMonotonicTs,
        ...(pageState.emitCostNs != undefined && { emitCostNs: pageState.emitCostNs }),
      })
    : undefined;
  return {
    ...result,
    run: {
      ...result.run,
      environment: {
        ...result.run.environment,
        ...(pageState.collectors != undefined && { collectors: pageState.collectors }),
      },
    },
    summary: {
      ...result.summary,
      steadyWindow,
      ...(telemetrySelf != undefined && { telemetrySelf }),
    },
  };
}
