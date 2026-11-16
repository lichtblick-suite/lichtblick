// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BufferedTelemetrySinkOptions,
  monotonicNow,
  setTelemetrySink,
  TelemetryBatch,
  TelemetryEvent,
} from "@lichtblick/suite-base/util/telemetry";

import { FrameLoop, FrameLoopEnv } from "../frameProbe";
import { parsePositiveNumberParam } from "../urlParams";
import { PausableInterval } from "./PausableInterval";
import { ToggleableTelemetrySink } from "./ToggleableTelemetrySink";
import { getDefaultRendererCollectorsEnv, RendererCollectors, SelfCostMeter } from "./collectors";
import {
  LATE_FRAME_THRESHOLD_QUERY_PARAM,
  RENDERER_REALM,
  TELEMETRY_OFF_VALUE,
  TELEMETRY_QUERY_PARAM,
  TELEMETRY_WINDOW_KEY,
  UA_MEMORY_QUERY_PARAM,
} from "./constants";
import { measureEmitCost, ZERO_EMIT_COST } from "./measureEmitCost";
import {
  BenchmarkTelemetryHandle,
  FrameProbeToggleRequest,
  InstallBenchmarkTelemetryOptions,
  LichtblickTelemetryWindowApi,
  TelemetryCollectorsState,
  TelemetryInstallTarget,
  TelemetryToggleRequest,
} from "./types";

const DISABLED_COLLECTORS_STATE: TelemetryCollectorsState = Object.freeze({ uaMemory: "disabled" });

const noopFrame = (_timestamp: number): void => {};

/**
 * Window API of `?telemetry=off`: records nothing; `setFrameProbeActive` switches a bare frame loop
 * (the benchmark FPS probe without the collector) for the frame-probe A/B. The loop never starts on
 * its own; it ends with the page.
 */
function buildDisabledApi(env: FrameLoopEnv): LichtblickTelemetryWindowApi {
  const frameProbe = new FrameLoop(env, noopFrame);
  return {
    isEnabled: () => false,
    now: monotonicNow,
    drain: (_maxRecords?: number): TelemetryBatch => ({
      realm: RENDERER_REALM,
      records: [],
      dropped: 0,
    }),
    collectorsState: () => DISABLED_COLLECTORS_STATE,
    measureEmitCost: (_iterations?: number) => ZERO_EMIT_COST,
    setTelemetryActive: (_request: TelemetryToggleRequest) => ({
      active: false,
      atMs: monotonicNow(),
      uaCalls: 0,
    }),
    setFrameProbeActive: ({ active }: FrameProbeToggleRequest) => {
      if (active) {
        frameProbe.start();
      } else {
        frameProbe.stop();
      }
      return { active: frameProbe.isRunning(), atMs: monotonicNow() };
    },
  };
}

// Guards against double installation per window (handle is undefined for `?telemetry=off`).
const installations = new WeakMap<object, BenchmarkTelemetryHandle | undefined>();

/** True unless the page URL has `?telemetry=off`. */
export function isBenchmarkTelemetryEnabled(url: URL): boolean {
  return url.searchParams.get(TELEMETRY_QUERY_PARAM) !== TELEMETRY_OFF_VALUE;
}

/** True unless the page URL has `?telemetry.uaMemory=off`. */
export function isUaMemoryCollectorEnabled(url: URL): boolean {
  return url.searchParams.get(UA_MEMORY_QUERY_PARAM) !== TELEMETRY_OFF_VALUE;
}

/**
 * Late-frame threshold override from `?telemetry.lateFrameThresholdMs=<ms>`; undefined (collector
 * default) when absent or not a positive finite number.
 */
export function parseLateFrameThresholdMs(url: URL): number | undefined {
  return parsePositiveNumberParam(url, LATE_FRAME_THRESHOLD_QUERY_PARAM);
}

type EnabledApiParts = {
  readonly sink: ToggleableTelemetrySink;
  readonly collectors: RendererCollectors;
  readonly selfCost: SelfCostMeter;
  /** Options the live sink was built from, minus `onEvent` and timers (for `measureEmitCost`). */
  readonly sinkOptions: BufferedTelemetrySinkOptions;
  /** Clock of the `measureEmitCost` loops. */
  readonly now: () => number;
  /** Switches recording (see `setTelemetryActive`). */
  readonly setActive: (request: TelemetryToggleRequest) => void;
};

function buildEnabledApi({
  sink,
  collectors,
  selfCost,
  sinkOptions,
  now,
  setActive,
}: EnabledApiParts): LichtblickTelemetryWindowApi {
  const drainTime = selfCost.counter("drainMs");
  return {
    isEnabled: () => sink.isEnabled(),
    now: monotonicNow,
    drain: (maxRecords?: number) => {
      // Self cost is only accounted while telemetry is active (toggled-off blocks drain too).
      if (!sink.isActive()) {
        return sink.drain(maxRecords);
      }
      const startMs = drainTime.now();
      const batch = sink.drain(maxRecords);
      drainTime.addSince(startMs);
      return batch;
    },
    collectorsState: () => ({ uaMemory: collectors.uaMemoryState() }),
    measureEmitCost: (iterations?: number) => measureEmitCost({ sinkOptions, now, iterations }),
    setTelemetryActive: (request: TelemetryToggleRequest) => {
      setActive(request);
      return {
        active: sink.isEnabled(),
        atMs: monotonicNow(),
        uaCalls: collectors.uaMemoryCalls(),
      };
    },
  };
}

/**
 * Activates benchmark telemetry for the benchmark page. Telemetry is only ever activated here (the
 * product has no flag). Call once, as early as possible in the entry point, before any player is
 * created: producers read `getTelemetry()` lazily, but the worker bridge decides whether to bridge
 * worker telemetry at source initialization.
 *
 * - `?telemetry=off`: nothing is recorded and nothing is measured; `window.lichtblickTelemetry` is
 *   still installed with `isEnabled() === false`, an always-empty `drain()`,
 *   `collectorsState().uaMemory === "disabled"`, an all-zero `measureEmitCost()` and
 *   `setFrameProbeActive()` (a bare frame loop for the frame-probe A/B, stopped until switched on).
 *   Returns undefined.
 * - otherwise: installs a `BufferedTelemetrySink` (realm "renderer") as the realm sink, starts its
 *   1 Hz publish timer and the renderer collectors, and exposes the sink through
 *   `window.lichtblickTelemetry`. `?telemetry.lateFrameThresholdMs=<ms>` overrides the late-frame
 *   threshold of the frame collector; `?telemetry.uaMemory=off` disables the UA-specific memory
 *   collector. Everything is stopped on `pagehide`/`beforeunload` (records stay drainable).
 *   `setTelemetryActive({ active })` switches recording off and on again in place (in-process
 *   overhead A/B); the sink is a `ToggleableTelemetrySink` in every enabled run, so the A/B arms and
 *   normal runs execute the same code.
 *
 * Self cost (`TELEMETRY_SELF_COST_METRICS`, enabled only): the sink's periodic publish is timed by
 * wrapping its handler through the sink's injectable `setInterval` option, `drain()` is timed in the
 * window API, and the collectors time their own callbacks; all of it is published on the collector
 * tick.
 */
export function installBenchmarkTelemetry(
  url: URL,
  options: InstallBenchmarkTelemetryOptions = {},
): BenchmarkTelemetryHandle | undefined {
  const target: TelemetryInstallTarget = options.target ?? window;
  if (installations.has(target)) {
    console.warn("installBenchmarkTelemetry called more than once; keeping the first installation");
    return installations.get(target);
  }

  const env = options.collectorsEnv ?? getDefaultRendererCollectorsEnv();
  if (!isBenchmarkTelemetryEnabled(url)) {
    target[TELEMETRY_WINDOW_KEY] = buildDisabledApi(env);
    installations.set(target, undefined);
    return undefined;
  }

  const selfCost = new SelfCostMeter(env.now);
  const sinkOptions: BufferedTelemetrySinkOptions = { realm: RENDERER_REALM };
  // The sink's publish timer, pausable for `setTelemetryActive({ active: false })`. Wrapped once when the sink
  // schedules it (`telemetry.self.timeMs.sinkPublish`).
  const publishTimer = new PausableInterval(
    (handler, intervalMs) => env.setInterval(selfCost.timed("sinkPublishMs", handler), intervalMs),
    env.clearInterval,
  );
  const sink = new ToggleableTelemetrySink({
    ...sinkOptions,
    // Only invoked for events recorded after `collectors` is initialized below (nothing records
    // into the sink before it is installed).
    onEvent: (event: TelemetryEvent) => {
      collectors.handleEvent(event);
    },
    setInterval: publishTimer.set,
    clearInterval: publishTimer.clear,
  });
  const collectors = new RendererCollectors(sink, env, {
    lateFrameThresholdMs: parseLateFrameThresholdMs(url),
    uaMemoryEnabled: isUaMemoryCollectorEnabled(url),
    selfCost,
  });

  sink.start();
  setTelemetrySink(sink);
  collectors.start();

  let appReadyEmitted = false;
  let disposed = false;

  const setActive = ({ active }: TelemetryToggleRequest): void => {
    if (disposed || active === sink.isActive()) {
      return;
    }
    if (active) {
      setTelemetrySink(sink);
      sink.setActive({ active: true });
      publishTimer.resume();
      collectors.resume();
      return;
    }
    // Partial collector window + pending series first, so nothing recorded while on is lost.
    collectors.pause();
    sink.publishNow();
    sink.setActive({ active: false });
    publishTimer.pause();
    setTelemetrySink(undefined);
  };

  target[TELEMETRY_WINDOW_KEY] = buildEnabledApi({
    sink,
    collectors,
    selfCost,
    sinkOptions,
    now: env.now,
    setActive,
  });

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    target.removeEventListener("pagehide", dispose);
    target.removeEventListener("beforeunload", dispose);
    collectors.dispose();
    // Final publish + stop. The sink stays installed but disabled, so producers become no-ops and
    // the runner can still drain what was recorded. A sink toggled off is ungated for the final
    // publish (nothing was recorded while off); its paused timer just gets forgotten.
    sink.setActive({ active: true });
    sink.dispose();
  };
  target.addEventListener("pagehide", dispose);
  target.addEventListener("beforeunload", dispose);

  const handle: BenchmarkTelemetryHandle = {
    markAppReady: () => {
      if (appReadyEmitted || !sink.isEnabled()) {
        return;
      }
      appReadyEmitted = true;
      sink.event("app.ready", "instant", "app");
    },
    dispose,
  };
  installations.set(target, handle);
  return handle;
}
