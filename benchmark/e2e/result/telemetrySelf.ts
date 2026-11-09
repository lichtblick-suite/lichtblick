// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// In-page telemetry self-cost over the steady window of an overhead A/B run (`summary.telemetrySelf`,
// see `TelemetrySelfSummaryV1`). Free of DOM/Playwright/Node imports (compiled by the root tsconfig
// too).

import {
  MS_PER_SECOND,
  RENDERER_REALM,
  TELEMETRY_SELF_TIME_METRICS,
  TELEMETRY_SELF_UA_CALLS_METRIC,
  TELEMETRY_SELF_UA_FAILURES_METRIC,
  TELEMETRY_SELF_UA_RESOLVED_METRIC,
  TELEMETRY_SELF_UA_RESOLVE_MS_METRIC,
} from "./constants";
import { counterTotal, counterTotalAt } from "./series";
import type {
  EmitCostNsV1,
  TelemetrySelfComponent,
  TelemetryRecordMix,
  TelemetrySelfInput,
  TelemetrySelfSummaryV1,
} from "./telemetrySelf.types";
import type {
  TelemetryRecord,
  TelemetrySample,
} from "../../../packages/suite-base/src/util/telemetry/types";

/** Nanoseconds per millisecond. */
const NS_PER_MS = 1e6;

/** Renderer-realm samples of the self-cost metrics, by metric name. */
function selfSamplesByMetric(records: readonly TelemetryRecord[]): Map<string, TelemetrySample[]> {
  const wanted = new Set<string>([
    ...Object.values(TELEMETRY_SELF_TIME_METRICS),
    TELEMETRY_SELF_UA_CALLS_METRIC,
    TELEMETRY_SELF_UA_RESOLVE_MS_METRIC,
    TELEMETRY_SELF_UA_RESOLVED_METRIC,
    TELEMETRY_SELF_UA_FAILURES_METRIC,
  ]);
  const byMetric = new Map<string, TelemetrySample[]>();
  for (const record of records) {
    if (record.kind !== "sample" || record.realm !== RENDERER_REALM || !wanted.has(record.metric)) {
      continue;
    }
    const list = byMetric.get(record.metric) ?? [];
    list.push(record);
    byMetric.set(record.metric, list);
  }
  return byMetric;
}

/** Timestamp of the earliest publish inside `(startTs, endTs]`; undefined without one. */
function firstPublishInWindow(
  samples: readonly TelemetrySample[],
  startTs: number,
  endTs: number,
): number | undefined {
  let first: number | undefined;
  for (const sample of samples) {
    const ts = sample.monotonicTs;
    if (ts > startTs && ts <= endTs && (first == undefined || ts < first)) {
      first = ts;
    }
  }
  return first;
}

/** Timestamp of the latest publish at or before `ts`; undefined without one. */
function lastPublishAtOrBefore(
  samples: readonly TelemetrySample[],
  ts: number,
): number | undefined {
  let last: number | undefined;
  for (const sample of samples) {
    const sampleTs = sample.monotonicTs;
    if (sampleTs <= ts && (last == undefined || sampleTs > last)) {
      last = sampleTs;
    }
  }
  return last;
}

/**
 * Increase of a cumulative counter between the publishes at or before `startTs` and `endTs`, per
 * second of `[startTs, endTs]` (both ends are quantized to the 1 Hz publish, so the errors largely
 * cancel). Without a publish at or before `startTs`, the first publish inside the window is the
 * baseline and the rate is taken over `[that publish, endTs]` instead (its pre-window total must
 * not count as window time). Undefined (not measured) unless the latest publish at or before
 * `endTs` is strictly later than the baseline publish (a single usable publish is not a rate of 0).
 */
function counterRatePerSec(
  samples: readonly TelemetrySample[],
  startTs: number,
  endTs: number,
): number | undefined {
  const publishAtStart = lastPublishAtOrBefore(samples, startTs);
  const baselinePublishTs = publishAtStart ?? firstPublishInWindow(samples, startTs, endTs);
  if (baselinePublishTs == undefined) {
    return undefined;
  }
  const endPublishTs = lastPublishAtOrBefore(samples, endTs);
  if (endPublishTs == undefined || endPublishTs <= baselinePublishTs) {
    return undefined;
  }
  const baselineTs = publishAtStart != undefined ? startTs : baselinePublishTs;
  const seconds = (endTs - baselineTs) / MS_PER_SECOND;
  if (Number.isNaN(seconds) || seconds <= 0) {
    return undefined;
  }
  const start = counterTotalAt(samples, baselineTs)!;
  const end = counterTotalAt(samples, endTs)!;
  return Math.max(0, end - start) / seconds;
}

/** Records (samples by metric type, events) stamped inside `[startTs, endTs]`. */
function recordMix(
  records: readonly TelemetryRecord[],
  startTs: number,
  endTs: number,
): TelemetryRecordMix {
  const mix: TelemetryRecordMix = { gauges: 0, counters: 0, events: 0 };
  for (const record of records) {
    if (record.monotonicTs < startTs || record.monotonicTs > endTs) {
      continue;
    }
    if (record.kind === "event") {
      mix.events += 1;
    } else if (record.metricType === "counter") {
      mix.counters += 1;
    } else {
      mix.gauges += 1;
    }
  }
  return mix;
}

/** Emit cost per record weighted by the record mix; the plain mean without records. */
export function meanEmitNs(cost: EmitCostNsV1, mix: TelemetryRecordMix): number {
  const total = mix.gauges + mix.counters + mix.events;
  if (total === 0) {
    return (cost.gaugeNs + cost.counterNs + cost.eventNs) / 3;
  }
  return (
    (mix.gauges * cost.gaugeNs + mix.counters * cost.counterNs + mix.events * cost.eventNs) / total
  );
}

function emitEstimate(
  cost: EmitCostNsV1 | undefined,
  mix: TelemetryRecordMix,
  recordsPerSec: number,
): Pick<TelemetrySelfSummaryV1, "emitCostNs" | "meanEmitNs" | "estimatedEmitMsPerSec"> {
  if (cost == undefined) {
    return {};
  }
  const perRecordNs = meanEmitNs(cost, mix);
  return {
    emitCostNs: cost,
    meanEmitNs: perRecordNs,
    estimatedEmitMsPerSec: (recordsPerSec * perRecordNs) / NS_PER_MS,
  };
}

/**
 * UA memory probe counts over the WHOLE run (not the steady window): a call may start before the
 * window and, as the browser resolves it lazily (with its next GC, ~10 s+), resolve after it.
 * `uaResolveMsMean` is the summed call → resolve latency divided by the RESOLVED calls (rejected and
 * still pending calls never add latency); omitted without resolved calls, and for page builds
 * without the `resolved` counter (the latency cannot be attributed to a call count then).
 */
function uaProbeCounts(
  byMetric: ReadonlyMap<string, readonly TelemetrySample[]>,
): Pick<TelemetrySelfSummaryV1, "uaCalls" | "uaResolved" | "uaFailures" | "uaResolveMsMean"> {
  const uaCalls = counterTotal(byMetric.get(TELEMETRY_SELF_UA_CALLS_METRIC)) ?? 0;
  const uaResolved = counterTotal(byMetric.get(TELEMETRY_SELF_UA_RESOLVED_METRIC));
  const uaFailures = counterTotal(byMetric.get(TELEMETRY_SELF_UA_FAILURES_METRIC));
  const uaResolveMs = counterTotal(byMetric.get(TELEMETRY_SELF_UA_RESOLVE_MS_METRIC));
  return {
    uaCalls,
    ...(uaResolved != undefined && { uaResolved }),
    ...(uaFailures != undefined && { uaFailures }),
    ...(uaResolved != undefined &&
      uaResolved > 0 &&
      uaResolveMs != undefined && { uaResolveMsMean: uaResolveMs / uaResolved }),
  };
}

/**
 * Self-cost of the page telemetry over the steady window: main-thread ms/s per component (from the
 * cumulative `telemetry.self.timeMs.*` counters; a component without two usable publishes is left
 * out as not measured), records/s, UA memory probe calls / outcomes and
 * mean resolve latency (whole run, see `uaProbeCounts`), and the emit cost estimate from the page's
 * micro-benchmark.
 */
export function summarizeTelemetrySelf(input: TelemetrySelfInput): TelemetrySelfSummaryV1 {
  const { pageRecords, startMonotonicTs: startTs, endMonotonicTs: endTs } = input;
  const windowSec = Math.max(0, (endTs - startTs) / MS_PER_SECOND);
  const byMetric = selfSamplesByMetric(pageRecords);

  const byComponent: Partial<Record<TelemetrySelfComponent, number>> = {};
  let total = 0;
  for (const [component, metric] of Object.entries(TELEMETRY_SELF_TIME_METRICS)) {
    const samples = byMetric.get(metric);
    if (samples == undefined) {
      continue;
    }
    const rate = counterRatePerSec(samples, startTs, endTs);
    if (rate == undefined) {
      continue;
    }
    byComponent[component as TelemetrySelfComponent] = rate;
    total += rate;
  }

  const mix = recordMix(pageRecords, startTs, endTs);
  const recordCount = mix.gauges + mix.counters + mix.events;
  const recordsPerSec = windowSec > 0 ? recordCount / windowSec : 0;
  const emit = emitEstimate(input.emitCostNs, mix, recordsPerSec);
  return {
    windowSec,
    msPerSec: { total, byComponent },
    recordsPerSec,
    ...uaProbeCounts(byMetric),
    ...emit,
    fractionOfCore: (total + (emit.estimatedEmitMsPerSec ?? 0)) / MS_PER_SECOND,
  };
}
