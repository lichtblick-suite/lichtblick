// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useEffect, useState } from "react";

import { useMemoryInfo } from "@lichtblick/hooks";
import Logger from "@lichtblick/log";
import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { APP_CONFIG } from "@lichtblick/suite-base/constants/config";
import AnalyticsContext from "@lichtblick/suite-base/context/AnalyticsContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import ITelemetry from "@lichtblick/suite-base/services/ITelemetry";
import NullAnalytics from "@lichtblick/suite-base/services/NullAnalytics";
import { sessionId, sessionStartedAt } from "@lichtblick/suite-base/services/telemetry/identity";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

const log = Logger.getLogger(__filename);

const HEARTBEAT_INTERVAL_MS = 30_000;
const MEMORY_SAMPLE_INTERVAL_MS = 5_000;

/**
 * Supplies `AnalyticsContext` with an `ITelemetry` instance for the OpenTelemetry PoC (see
 * docs/telemetry/poc-opentelemetry-plano.md). Fails closed: falls back to `NullAnalytics` whenever
 * telemetry is disabled or no collector endpoint is configured, so this is a no-op in any build
 * that doesn't opt in.
 */
export default function TelemetryProvider({
  children,
}: Readonly<PropsWithChildren>): React.JSX.Element {
  const [telemetryEnabled = false] = useAppConfigurationValue<boolean>(
    AppSetting.TELEMETRY_ENABLED,
  );

  const [telemetry, setTelemetry] = useState<ITelemetry>(() => new NullAnalytics());

  useEffect(() => {
    if (!telemetryEnabled || APP_CONFIG.otlpEndpoint == undefined) {
      // Logged on purpose: failing closed silently is indistinguishable from working, which turns
      // any misconfiguration into a long debugging session. OTLP_ENDPOINT is a *build-time* define
      // for the renderer (unlike the main process, which reads it at runtime).
      log.warn(
        telemetryEnabled
          ? "Telemetry is enabled but this build has no OTLP_ENDPOINT compiled in, so nothing is " +
              "collected. Rebuild with OTLP_ENDPOINT=<collector-url> (docs/telemetry/poc/README.md)."
          : "Telemetry is disabled (no opt-in), so nothing is collected.",
      );
      setTelemetry(new NullAnalytics());
      return;
    }

    let cancelled = false;
    const endpoint = APP_CONFIG.otlpEndpoint;
    // Dynamic import: the OTel SDK is excluded from the bundle entirely unless a build both
    // enables telemetry by default and configures an endpoint, or the user opts in at runtime.
    void import("@lichtblick/suite-base/services/telemetry/OtelTelemetry").then(
      ({ default: OtelTelemetry }) => {
        if (!cancelled) {
          log.info(`Telemetry enabled, exporting to ${endpoint}`);
          setTelemetry(
            new OtelTelemetry({
              endpoint,
              version: APP_CONFIG.version,
              platform: isDesktopApp() ? "desktop" : "web",
              osType: navigator.platform,
            }),
          );
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [telemetryEnabled]);

  const memoryInfo = useMemoryInfo({ refreshIntervalMs: MEMORY_SAMPLE_INTERVAL_MS });
  useEffect(() => {
    if (memoryInfo) {
      telemetry.recordValue("lichtblick.memory.heap.used", memoryInfo.usedJSHeapSize, {
        session_id: sessionId,
      });
    }
  }, [telemetry, memoryInfo]);

  useEffect(() => {
    // Session duration is a gauge refreshed on every heartbeat rather than a value computed at
    // shutdown: kill, OOM and power loss never fire an end-of-session event (see plan section 6).
    // The dashboard takes percentiles across sessions from this series.
    const reportSessionDuration = () => {
      telemetry.recordValue("lichtblick.session.duration", (Date.now() - sessionStartedAt) / 1000, {
        session_id: sessionId,
      });
    };

    telemetry.logEvent(AppEvent.APP_INIT);
    reportSessionDuration();
    const interval = setInterval(() => {
      telemetry.logEvent(AppEvent.SESSION_HEARTBEAT);
      reportSessionDuration();
    }, HEARTBEAT_INTERVAL_MS);

    const handlePageHide = () => {
      void telemetry.flush();
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
      void telemetry.flush();
    };
  }, [telemetry]);

  return <AnalyticsContext.Provider value={telemetry}>{children}</AnalyticsContext.Provider>;
}
