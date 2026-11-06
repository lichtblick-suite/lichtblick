// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BufferedTelemetrySink,
  monotonicNow,
  setTelemetrySink,
  TelemetryBatch,
  TelemetryEvent,
} from "@lichtblick/suite-base/util/telemetry";

import { parsePositiveNumberParam } from "../urlParams";
import { getDefaultRendererCollectorsEnv, RendererCollectors, SelfCostMeter } from "./collectors";
import {
  LATE_FRAME_THRESHOLD_QUERY_PARAM,
  RENDERER_REALM,
  TELEMETRY_OFF_VALUE,
  TELEMETRY_QUERY_PARAM,
  TELEMETRY_WINDOW_KEY,
} from "./constants";
import {
  BenchmarkTelemetryHandle,
  InstallBenchmarkTelemetryOptions,
  LichtblickTelemetryWindowApi,
  TelemetryInstallTarget,
} from "./types";

/** Window API of `?telemetry=off`: records nothing. */
function buildDisabledApi(): LichtblickTelemetryWindowApi {
  return {
    isEnabled: () => false,
    now: monotonicNow,
    drain: (_maxRecords?: number): TelemetryBatch => ({
      realm: RENDERER_REALM,
      records: [],
      dropped: 0,
    }),
  };
}

// Guards against double installation per window (handle is undefined for `?telemetry=off`).
const installations = new WeakMap<object, BenchmarkTelemetryHandle | undefined>();

/** True unless the page URL has `?telemetry=off`. */
export function isBenchmarkTelemetryEnabled(url: URL): boolean {
  return url.searchParams.get(TELEMETRY_QUERY_PARAM) !== TELEMETRY_OFF_VALUE;
}

/**
 * Late-frame threshold override from `?telemetry.lateFrameThresholdMs=<ms>`; undefined (collector
 * default) when absent or not a positive finite number.
 */
export function parseLateFrameThresholdMs(url: URL): number | undefined {
  return parsePositiveNumberParam(url, LATE_FRAME_THRESHOLD_QUERY_PARAM);
}

function buildEnabledApi(
  sink: BufferedTelemetrySink,
  selfCost: SelfCostMeter,
): LichtblickTelemetryWindowApi {
  const drainTime = selfCost.counter("drainMs");
  return {
    isEnabled: () => sink.isEnabled(),
    now: monotonicNow,
    drain: (maxRecords?: number) => {
      const startMs = drainTime.now();
      const batch = sink.drain(maxRecords);
      drainTime.addSince(startMs);
      return batch;
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
 *   still installed with `isEnabled() === false` and an always-empty `drain()`. Returns undefined.
 * - otherwise: installs a `BufferedTelemetrySink` (realm "renderer") as the realm sink, starts its
 *   1 Hz publish timer and the renderer collectors, and exposes the sink through
 *   `window.lichtblickTelemetry`. `?telemetry.lateFrameThresholdMs=<ms>` overrides the late-frame
 *   threshold of the frame collector. Everything is stopped on `pagehide`/`beforeunload` (records
 *   stay drainable).
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

  if (!isBenchmarkTelemetryEnabled(url)) {
    target[TELEMETRY_WINDOW_KEY] = buildDisabledApi();
    installations.set(target, undefined);
    return undefined;
  }

  const env = options.collectorsEnv ?? getDefaultRendererCollectorsEnv();
  const selfCost = new SelfCostMeter(env.now);
  const sink = new BufferedTelemetrySink({
    realm: RENDERER_REALM,
    // Only invoked for events recorded after `collectors` is initialized below (nothing records
    // into the sink before it is installed).
    onEvent: (event: TelemetryEvent) => {
      collectors.handleEvent(event);
    },
    // The sink's periodic publish, timed once when the sink schedules it
    // (`telemetry.self.timeMs.sinkPublish`).
    setInterval: (handler, intervalMs) =>
      env.setInterval(selfCost.timed("sinkPublishMs", handler), intervalMs),
    clearInterval: env.clearInterval,
  });
  const collectors = new RendererCollectors(sink, env, {
    lateFrameThresholdMs: parseLateFrameThresholdMs(url),
    selfCost,
  });

  sink.start();
  setTelemetrySink(sink);
  collectors.start();

  let appReadyEmitted = false;
  let disposed = false;

  target[TELEMETRY_WINDOW_KEY] = buildEnabledApi(sink, selfCost);

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    target.removeEventListener("pagehide", dispose);
    target.removeEventListener("beforeunload", dispose);
    collectors.dispose();
    // Final publish + stop. The sink stays installed but disabled, so producers become no-ops and
    // the runner can still drain what was recorded.
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
