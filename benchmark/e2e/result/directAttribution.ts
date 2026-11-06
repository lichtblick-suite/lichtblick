// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Direct (JS only) CPU attribution of the telemetry overhead: attributes the samples of a CDP
// `Profiler` profile of the renderer main thread to telemetry code (frames resolved to original
// sources) and relates the telemetry time to the toggle off blocks' CPU. Free of DOM/Playwright/
// Node imports (compiled by the root tsconfig too); frames are resolved by an injected resolver.

import { DIRECT_ATTRIBUTION_TOP_FUNCTIONS } from "./constants";
import type {
  AttributedFunction,
  CpuProfile,
  CpuProfileAttribution,
  CpuProfileNode,
  DirectAttributionConfigV3,
  DirectAttributionV3,
  FrameResolver,
  MainThreadProfileCapture,
  ResolvedFrame,
} from "./directAttribution.types";
import type { Verdict } from "./stats.types";

/** V8 pseudo frames of a profile (empty URL): not JS of a script. */
const IDLE_FRAME = "(idle)";
const PROGRAM_FRAME = "(program)";
const GC_FRAME = "(garbage collector)";
const ANONYMOUS_FUNCTION = "(anonymous)";
const US_PER_MS = 1000;
const MS_PER_SEC = 1000;
/** CPU ms per second of one percent of a core. */
const CPU_MS_PER_SEC_PER_PERCENT = 10;

/** Per node: its outermost telemetry frame (if any) and whether its stack has an unmapped frame. */
type NodeAttribution = { telemetry?: AttributedFunction; unmapped: boolean };

/** Whether `source` is one of `telemetrySources` (exact file, or under a `…/` directory prefix). */
export function isTelemetrySource(source: string, telemetrySources: readonly string[]): boolean {
  return telemetrySources.some((prefix) =>
    prefix.endsWith("/") ? source.startsWith(prefix) : source === prefix,
  );
}

/**
 * Duration of every sample, µs: up to the next sample's timestamp, the last one up to
 * `profile.endTime` (never negative).
 */
export function sampleDurationsUs(profile: CpuProfile): number[] {
  const deltas = profile.timeDeltas ?? [];
  const count = Math.min(profile.samples?.length ?? 0, deltas.length);
  const durations = new Array<number>(count);
  let timestamp = profile.startTime;
  for (let index = 0; index < count; index++) {
    timestamp += deltas[index]!;
    const next = index + 1 < count ? timestamp + deltas[index + 1]! : profile.endTime;
    durations[index] = Math.max(0, next - timestamp);
  }
  return durations;
}

/**
 * Attribution of every profile node, top-down: a node inherits its parent's outermost telemetry
 * frame (so nested telemetry frames never count twice), else is its own when its frame resolves to
 * a telemetry source. A node is `unmapped` (could hide telemetry) below an unmapped frame of a script
 * without a source map or whose map lists a telemetry source; an unmapped position of a script
 * whose map lists none is a module without a map (vendor code), never a (mapped, first-party)
 * telemetry source.
 */
function attributeNodes(
  profile: CpuProfile,
  resolve: FrameResolver,
  telemetrySources: readonly string[],
): Map<number, NodeAttribution> {
  const nodes = new Map<number, CpuProfileNode>(profile.nodes.map((node) => [node.id, node]));
  const scriptHasTelemetry = new Map<readonly string[], boolean>();
  const mayHideTelemetry = (frame: Extract<ResolvedFrame, { kind: "unmapped" }>): boolean => {
    const sources = frame.scriptSources;
    if (sources == undefined) {
      return true;
    }
    let hasTelemetry = scriptHasTelemetry.get(sources);
    if (hasTelemetry == undefined) {
      hasTelemetry = sources.some((source) => isTelemetrySource(source, telemetrySources));
      scriptHasTelemetry.set(sources, hasTelemetry);
    }
    return hasTelemetry;
  };
  const childIds = new Set(profile.nodes.flatMap((node) => node.children ?? []));
  const result = new Map<number, NodeAttribution>();
  const stack: { id: number; parent: NodeAttribution }[] = profile.nodes
    .filter((node) => !childIds.has(node.id))
    .map((node) => ({ id: node.id, parent: { unmapped: false } }));
  while (stack.length > 0) {
    const { id, parent } = stack.pop()!;
    const node = nodes.get(id);
    if (node == undefined || result.has(id)) {
      continue;
    }
    const own: NodeAttribution = { ...parent };
    const { callFrame } = node;
    if (callFrame.url !== "") {
      const frame = resolve(callFrame);
      if (frame.kind === "unmapped") {
        own.unmapped ||= mayHideTelemetry(frame);
      } else if (
        frame.kind === "mapped" &&
        own.telemetry == undefined &&
        isTelemetrySource(frame.source, telemetrySources)
      ) {
        own.telemetry = {
          source: frame.source,
          line: frame.line,
          name: frame.name ?? (callFrame.functionName || ANONYMOUS_FUNCTION),
          ms: 0,
        };
      }
    }
    result.set(id, own);
    for (const childId of node.children ?? []) {
      stack.push({ id: childId, parent: own });
    }
  }
  return result;
}

/** Key of a telemetry function (source, line and name). */
function functionKey(fn: AttributedFunction): string {
  return `${fn.source}:${fn.line}:${fn.name}`;
}

/**
 * Splits the sampled time of `profile` into idle, program, GC and JS, and the JS time into
 * telemetry (outermost telemetry frame of the stack, inclusive) and unresolved (an unmapped bundle
 * frame and no telemetry frame). See `CpuProfileAttribution`.
 */
export function attributeCpuProfile(
  profile: CpuProfile,
  resolve: FrameResolver,
  telemetrySources: readonly string[],
): CpuProfileAttribution {
  const nodes = new Map<number, CpuProfileNode>(profile.nodes.map((node) => [node.id, node]));
  const attributions = attributeNodes(profile, resolve, telemetrySources);
  const durations = sampleDurationsUs(profile);
  const functions = new Map<string, AttributedFunction>();
  const totals = { idleUs: 0, programUs: 0, gcUs: 0, jsUs: 0, telemetryUs: 0, unresolvedUs: 0 };
  durations.forEach((durationUs, index) => {
    const nodeId = profile.samples![index]!;
    const functionName = nodes.get(nodeId)?.callFrame.functionName;
    if (functionName === IDLE_FRAME) {
      totals.idleUs += durationUs;
      return;
    }
    if (functionName === PROGRAM_FRAME) {
      totals.programUs += durationUs;
      return;
    }
    if (functionName === GC_FRAME) {
      totals.gcUs += durationUs;
      return;
    }
    totals.jsUs += durationUs;
    const attribution = attributions.get(nodeId);
    if (attribution?.telemetry != undefined) {
      totals.telemetryUs += durationUs;
      const key = functionKey(attribution.telemetry);
      const fn = functions.get(key) ?? { ...attribution.telemetry, ms: 0 };
      fn.ms += durationUs / US_PER_MS;
      functions.set(key, fn);
    } else if (attribution?.unmapped === true) {
      totals.unresolvedUs += durationUs;
    }
  });
  return {
    durationMs: Math.max(0, profile.endTime - profile.startTime) / US_PER_MS,
    samples: durations.length,
    idleMs: totals.idleUs / US_PER_MS,
    programMs: totals.programUs / US_PER_MS,
    gcMs: totals.gcUs / US_PER_MS,
    jsMs: totals.jsUs / US_PER_MS,
    telemetryMs: totals.telemetryUs / US_PER_MS,
    unresolvedMs: totals.unresolvedUs / US_PER_MS,
    telemetryFunctions: [...functions.values()].sort((a, b) => b.ms - a.ms),
  };
}

/**
 * Verdict of the direct attribution: `exceeds` when the attributed telemetry time alone is above
 * the target, `within` when even telemetry plus unresolved time is at or below it, else (or
 * without an off-block baseline) `inconclusive`.
 */
export function directAttributionVerdict(
  relative: number | undefined,
  relativeUpperBound: number | undefined,
  target: number,
): Verdict {
  if (relative == undefined || relativeUpperBound == undefined) {
    return "inconclusive";
  }
  if (relative > target) {
    return "exceeds";
  }
  return relativeUpperBound <= target ? "within" : "inconclusive";
}

export type BuildDirectAttributionInput = {
  capture: MainThreadProfileCapture;
  resolve: FrameResolver;
  config: DirectAttributionConfigV3;
  /** Mean CPU of the included toggle off blocks (per-core sum, percent); absent without them. */
  offCpuPercent: number | undefined;
  /** Relative CPU target (`OVERHEAD_TARGETS.cpuDeltaRelativeMax`). */
  target: number;
};

/** The report's `directAttribution` of a profiled period (see `DirectAttributionV3`). */
export function buildDirectAttribution(input: BuildDirectAttributionInput): DirectAttributionV3 {
  const { capture, config } = input;
  if (capture.status === "unsupported") {
    return { status: "unsupported", config, reason: capture.reason };
  }
  const attribution = attributeCpuProfile(capture.profile, input.resolve, config.telemetrySources);
  const seconds = attribution.durationMs / MS_PER_SEC;
  const perSec = (ms: number) => (seconds > 0 ? ms / seconds : 0);
  const jsMsPerSec = perSec(attribution.jsMs);
  const telemetryMsPerSec = perSec(attribution.telemetryMs);
  const unresolvedMsPerSec = perSec(attribution.unresolvedMs);
  const gcMsPerSec = perSec(attribution.gcMs);
  const offCpuMsPerSec =
    input.offCpuPercent != undefined && input.offCpuPercent > 0
      ? input.offCpuPercent * CPU_MS_PER_SEC_PER_PERCENT
      : undefined;
  const relative = offCpuMsPerSec != undefined ? telemetryMsPerSec / offCpuMsPerSec : undefined;
  const relativeUpperBound =
    offCpuMsPerSec != undefined
      ? (telemetryMsPerSec + unresolvedMsPerSec) / offCpuMsPerSec
      : undefined;
  return {
    status: "measured",
    config,
    durationMs: attribution.durationMs,
    samples: attribution.samples,
    jsMsPerSec,
    telemetryMsPerSec,
    unresolvedMsPerSec,
    resolvedShare: attribution.jsMs > 0 ? 1 - attribution.unresolvedMs / attribution.jsMs : 1,
    gcMsPerSec,
    gcShare: attribution.jsMs + attribution.gcMs > 0 ? gcMsPerSec / (jsMsPerSec + gcMsPerSec) : 0,
    ...(offCpuMsPerSec != undefined && { offCpuPercent: input.offCpuPercent, offCpuMsPerSec }),
    ...(relative != undefined && { relative }),
    ...(relativeUpperBound != undefined && { relativeUpperBound }),
    topFunctions: attribution.telemetryFunctions
      .slice(0, DIRECT_ATTRIBUTION_TOP_FUNCTIONS)
      .map(({ source, line, name, ms }) => ({ source, line, name, msPerSec: perSec(ms) })),
    verdict: directAttributionVerdict(relative, relativeUpperBound, input.target),
  };
}
