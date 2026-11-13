// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Types of the direct CPU attribution (`result/directAttribution.ts`): a CDP `Profiler` profile of
// the renderer main thread with telemetry on, its frames resolved to original sources. Type-only:
// also read by the report and the CI summary through `runner/overhead.types.ts`.

import type { Verdict } from "./stats.types";

/** CDP `Runtime.CallFrame` fields the attribution reads (line and column are 0-based). */
export type CpuProfileCallFrame = {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
};

/** CDP `Profiler.ProfileNode` fields the attribution reads. */
export type CpuProfileNode = {
  id: number;
  callFrame: CpuProfileCallFrame;
  children?: number[];
};

/** CDP `Profiler.Profile` (times in µs; `timeDeltas[i]` is the time since sample `i − 1`). */
export type CpuProfile = {
  nodes: CpuProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
};

/** Outcome of the profiled period (`runner/cpuProfile.ts`). */
export type MainThreadProfileCapture =
  | { status: "captured"; profile: CpuProfile }
  | { status: "unsupported"; reason: string };

/**
 * A call frame resolved through the bundle's source map:
 * - `mapped`: original `source` (repo-relative, `/`-separated), 1-based `line`, original `name`;
 * - `unmapped`: a bundle script whose position has no mapping (or whose map is missing);
 * - `external`: a script that is not part of the bundle (Playwright evaluation scripts, …).
 */
export type ResolvedFrame =
  | { kind: "mapped"; source: string; line: number; name?: string }
  /**
   * No original position. `scriptSources`: the (repo-relative) sources of the script's source map
   * when it has one; webpack maps a module completely or not at all, so the position belongs to a
   * module outside these sources.
   */
  | { kind: "unmapped"; scriptSources?: readonly string[] }
  | { kind: "external" };

/** Resolves a call frame with a script URL (`runner/bundleSourceResolver.ts`). */
export type FrameResolver = (frame: CpuProfileCallFrame) => ResolvedFrame;

/** A telemetry function of the profile: inclusive time as the outermost telemetry frame. */
export type AttributedFunction = {
  /** Repo-relative original source. */
  source: string;
  /** 1-based line of the function start. */
  line: number;
  name: string;
  ms: number;
};

/**
 * Sampled time of a profile by category (ms). Every sample counts once:
 * - `idleMs` / `programMs` (native browser work outside JS) / `gcMs`: V8's pseudo nodes;
 * - `jsMs`: every other sample, split into `telemetryMs` (some frame of the stack resolves to a
 *   telemetry source; inclusive time of the outermost one, no double counting), `unresolvedMs` (no
 *   telemetry frame, but an unmapped bundle frame that could hide one) and the rest.
 */
export type CpuProfileAttribution = {
  durationMs: number;
  samples: number;
  idleMs: number;
  programMs: number;
  gcMs: number;
  jsMs: number;
  telemetryMs: number;
  unresolvedMs: number;
  /** Telemetry functions by inclusive time, descending. */
  telemetryFunctions: AttributedFunction[];
};

/** Settings of the profiled period. */
export type DirectAttributionConfigV3 = {
  /** Profiled period after the toggle blocks (`BENCHMARK_OVERHEAD_PROFILE_MS`). */
  profileMs: number;
  /** CDP `Profiler.setSamplingInterval`, µs. */
  samplingIntervalUs: number;
  /** Original source paths (prefixes) counted as telemetry. */
  telemetrySources: readonly string[];
};

/** A top telemetry function of the report. */
export type DirectAttributionFunctionV3 = {
  source: string;
  line: number;
  name: string;
  msPerSec: number;
};

/**
 * Direct (JS only) CPU attribution of the overhead report: renderer main-thread JS time spent in
 * telemetry code with telemetry on, relative to the toggle off blocks' CPU. Its own verdict against
 * the relative CPU target, never merged into the statistical (toggle) CPU verdict.
 */
export type DirectAttributionV3 =
  | { status: "unsupported"; config: DirectAttributionConfigV3; reason: string }
  | {
      status: "measured";
      config: DirectAttributionConfigV3;
      /** Profiled wall time, ms. */
      durationMs: number;
      samples: number;
      /**
       * Sampled time with a JS stack (everything but idle, program and GC), ms/s. Sampled wall
       * time, not CPU: it includes blocking native calls under JS (synchronous WebGL such as
       * `bufferSubData`), so it can far exceed the renderer's CPU.
       */
      jsMsPerSec: number;
      /** Inclusive time of the outermost telemetry frames, ms/s. */
      telemetryMsPerSec: number;
      /** JS time with an unmapped bundle frame and no telemetry frame, ms/s (could hide telemetry). */
      unresolvedMsPerSec: number;
      /** Share of the JS time whose stack resolved (`1 − unresolved / js`). */
      resolvedShare: number;
      /** Garbage collection, ms/s (informational, not attributable). */
      gcMsPerSec: number;
      /** GC / (JS + GC). */
      gcShare: number;
      /** Mean CPU of the toggle off blocks (per-core sum, 100 = one core); absent without them. */
      offCpuPercent?: number;
      /** `offCpuPercent × 10` (CPU ms per second). */
      offCpuMsPerSec?: number;
      /** `telemetryMsPerSec / offCpuMsPerSec`. */
      relative?: number;
      /** `(telemetryMsPerSec + unresolvedMsPerSec) / offCpuMsPerSec`. */
      relativeUpperBound?: number;
      topFunctions: DirectAttributionFunctionV3[];
      /** `exceeds` when `relative` > target, `within` when `relativeUpperBound` ≤ target. */
      verdict: Verdict;
    };
