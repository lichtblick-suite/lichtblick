// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BufferedTelemetrySink,
  monotonicNow,
  setTelemetrySink,
  TelemetryBatch,
  TelemetryEvent,
} from "@lichtblick/suite-base/util/telemetry";

import { getDefaultRendererCollectorsEnv, RendererCollectors } from "./collectors";
import {
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

const DISABLED_API: LichtblickTelemetryWindowApi = {
  isEnabled: () => false,
  now: monotonicNow,
  drain: (_maxRecords?: number): TelemetryBatch => ({
    realm: RENDERER_REALM,
    records: [],
    dropped: 0,
  }),
};

// Guards against double installation per window (handle is undefined for `?telemetry=off`).
const installations = new WeakMap<object, BenchmarkTelemetryHandle | undefined>();

/** True unless the page URL has `?telemetry=off`. */
export function isBenchmarkTelemetryEnabled(url: URL): boolean {
  return url.searchParams.get(TELEMETRY_QUERY_PARAM) !== TELEMETRY_OFF_VALUE;
}

/**
 * Activates benchmark telemetry for the benchmark page. Telemetry is only ever activated here (the
 * product has no flag). Call once, as early as possible in the entry point, before any player is
 * created: producers read `getTelemetry()` lazily, but the worker bridge decides whether to bridge
 * worker telemetry at source initialization.
 *
 * - `?telemetry=off`: nothing is recorded; `window.lichtblickTelemetry` is still installed with
 *   `isEnabled() === false` and an always-empty `drain()`. Returns undefined.
 * - otherwise: installs a `BufferedTelemetrySink` (realm "renderer") as the realm sink, starts its
 *   1 Hz publish timer and the renderer collectors, and exposes the sink through
 *   `window.lichtblickTelemetry`. Everything is stopped on `pagehide`/`beforeunload` (records stay
 *   drainable).
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
    target[TELEMETRY_WINDOW_KEY] = DISABLED_API;
    installations.set(target, undefined);
    return undefined;
  }

  const sink = new BufferedTelemetrySink({
    realm: RENDERER_REALM,
    // Only invoked for events recorded after `collectors` is initialized below (nothing records
    // into the sink before it is installed).
    onEvent: (event: TelemetryEvent) => {
      collectors.handleEvent(event);
    },
  });
  const collectors = new RendererCollectors(
    sink,
    options.collectorsEnv ?? getDefaultRendererCollectorsEnv(),
  );

  sink.start();
  setTelemetrySink(sink);
  collectors.start();

  target[TELEMETRY_WINDOW_KEY] = {
    isEnabled: () => sink.isEnabled(),
    now: monotonicNow,
    drain: (maxRecords?: number) => sink.drain(maxRecords),
  };

  let appReadyEmitted = false;
  let disposed = false;
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
