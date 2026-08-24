// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { app, WebContents } from "electron";

import Logger from "@lichtblick/log";
import { APP_CONFIG } from "@lichtblick/suite-base/src/constants/config";
import { AppEvent } from "@lichtblick/suite-base/src/services/IAnalytics";
import ITelemetry from "@lichtblick/suite-base/src/services/ITelemetry";
import NullAnalytics from "@lichtblick/suite-base/src/services/NullAnalytics";
import OtelTelemetry from "@lichtblick/suite-base/src/services/telemetry/OtelTelemetry";

import { getTelemetrySettings } from "./telemetry";
import { LICHTBLICK_PRODUCT_VERSION } from "../common/webpackDefines";

const log = Logger.getLogger(__filename);

const RSS_REPORT_INTERVAL_MS = 30_000;

let telemetry: ITelemetry | undefined;

/**
 * Lazily built, process-wide telemetry instance for the main process. Fails closed: `NullAnalytics`
 * unless telemetry is enabled (see `getTelemetrySettings`) and an OTLP collector endpoint is
 * configured via the `OTLP_ENDPOINT` environment variable (see docs/telemetry/poc-opentelemetry-plano.md).
 */
function getTelemetry(): ITelemetry {
  if (!telemetry) {
    const { telemetryEnabled } = getTelemetrySettings();
    // Runtime env var first, build-time define second. The fallback exists so that setting
    // OTLP_ENDPOINT for the build (which the renderer requires) is enough for the main process too:
    // needing it in *both* places silently cost a whole round of OOM testing once.
    const endpoint = process.env.OTLP_ENDPOINT ?? APP_CONFIG.otlpEndpoint;
    if (telemetryEnabled && endpoint != undefined) {
      telemetry = new OtelTelemetry({
        endpoint,
        version: LICHTBLICK_PRODUCT_VERSION,
        platform: "desktop",
        osType: process.platform,
      });
      log.info(`Main process telemetry enabled, exporting to ${endpoint}`);
    } else {
      telemetry = new NullAnalytics();
      // Logged loudly on purpose: an inert main process is indistinguishable from a working one
      // otherwise, and it is the only process that can witness a renderer crash or OOM. Note the
      // endpoint is a *runtime* env var here, while the renderer takes it as a build-time define.
      log.warn(
        telemetryEnabled
          ? "Main process telemetry is enabled but no OTLP endpoint is configured (neither the " +
              "OTLP_ENDPOINT env var nor a build-time define), so crashes/OOM and RSS will NOT be " +
              "reported. Relaunch with OTLP_ENDPOINT=<collector-url> (docs/telemetry/poc/README.md)."
          : "Main process telemetry is disabled (no opt-in), so crashes/OOM and RSS will NOT be " +
              "reported. Enable it in Settings > Privacy.",
      );
    }
  }
  return telemetry;
}

/**
 * Starts periodic RSS reporting for every OS process the app has spawned (browser, renderer, GPU,
 * utility, ...) and reports non-renderer child process crashes/OOMs. Call once from `main/index.ts`.
 * See plan Phase 3/4.
 */
export function startProcessMetricsReporting(): void {
  setInterval(() => {
    for (const metric of app.getAppMetrics()) {
      getTelemetry().recordValue(
        "lichtblick.memory.process.rss",
        metric.memory.workingSetSize * 1024, // Electron reports KB; OTel convention is bytes.
        { process_type: metric.type },
      );
    }
  }, RSS_REPORT_INTERVAL_MS).unref();

  app.on("child-process-gone", (_event, details) => {
    const telemetryInstance = getTelemetry();
    telemetryInstance.logEvent(AppEvent.RENDERER_GONE, {
      reason: details.reason,
      exit_code: details.exitCode,
      process_type: details.type,
      app_version: LICHTBLICK_PRODUCT_VERSION,
    });
    // Flushed immediately: crash events are batched otherwise, and the user closing the app right
    // after a crash is exactly the case we must not lose.
    void telemetryInstance.flush();
  });
}

/**
 * Reports when `contents` (a window's renderer process) crashes, is killed or runs out of memory.
 * `details.reason === "oom"` is the signal the PoC's A5 acceptance criterion checks for. Call for
 * every window's webContents (see StudioWindow.ts). See plan Phase 4.
 */
export function attachRendererGoneTelemetry(contents: WebContents): void {
  contents.on("render-process-gone", (_event, details) => {
    const telemetryInstance = getTelemetry();
    telemetryInstance.logEvent(AppEvent.RENDERER_GONE, {
      reason: details.reason,
      exit_code: details.exitCode,
      app_version: LICHTBLICK_PRODUCT_VERSION,
    });
    // Flushed immediately: crash events are batched otherwise, and the user closing the app right
    // after a crash is exactly the case we must not lose.
    void telemetryInstance.flush();
  });
}
