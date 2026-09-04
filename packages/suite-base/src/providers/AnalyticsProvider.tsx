// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useEffect, useRef, useState } from "react";

import Logger from "@lichtblick/log";
import { APP_CONFIG } from "@lichtblick/suite-base/constants/config";
import AnalyticsContext from "@lichtblick/suite-base/context/AnalyticsContext";
import type IAnalytics from "@lichtblick/suite-base/services/IAnalytics";
import NullAnalytics from "@lichtblick/suite-base/services/NullAnalytics";
import type OtelAnalytics from "@lichtblick/suite-base/services/telemetry/OtelAnalytics";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

const log = Logger.getLogger(__filename);
const NULL_ANALYTICS = new NullAnalytics();

async function flushAndShutdown(analytics: OtelAnalytics): Promise<void> {
  try {
    await analytics.flush();
  } catch (error) {
    log.error("Failed to flush OpenTelemetry analytics", error);
  }

  try {
    await analytics.shutdown();
  } catch (error) {
    log.error("Failed to shut down OpenTelemetry analytics", error);
  }
}

export default function AnalyticsProvider({
  children,
}: Readonly<PropsWithChildren>): React.JSX.Element {
  const [analytics, setAnalytics] = useState<IAnalytics>(() => NULL_ANALYTICS);
  const analyticsRef = useRef<OtelAnalytics | undefined>();

  // Telemetry is opt-in at build time only: if OTLP_ENDPOINT was compiled into
  // APP_CONFIG.otlpEndpoint, analytics connect automatically; otherwise NullAnalytics is used.
  // There is intentionally no runtime user-facing toggle.
  useEffect(() => {
    let cancelled = false;
    let created: OtelAnalytics | undefined;

    if (APP_CONFIG.otlpEndpoint == undefined) {
      log.debug("No OTLP endpoint was compiled in; analytics events will not be exported.");
      analyticsRef.current = undefined;
      setAnalytics((current) => (current === NULL_ANALYTICS ? current : NULL_ANALYTICS));
      return;
    }

    const platform = isDesktopApp() ? "desktop" : "web";
    log.info(`Initializing OpenTelemetry analytics for the ${platform} app.`);

    void import("@lichtblick/suite-base/services/telemetry/OtelAnalytics")
      .then(({ default: OtelAnalyticsImpl }) => {
        const nextAnalytics = new OtelAnalyticsImpl({
          endpoint: APP_CONFIG.otlpEndpoint!,
          version: APP_CONFIG.version,
          platform,
        });

        if (cancelled) {
          void flushAndShutdown(nextAnalytics);
          return;
        }

        created = nextAnalytics;
        analyticsRef.current = nextAnalytics;
        setAnalytics(nextAnalytics);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        analyticsRef.current = undefined;
        setAnalytics(NULL_ANALYTICS);
        log.error("Failed to initialize OpenTelemetry analytics", error);
      });

    return () => {
      cancelled = true;
      if (created != undefined) {
        if (analyticsRef.current === created) {
          analyticsRef.current = undefined;
        }
        void flushAndShutdown(created);
      }
    };
    // otlpEndpoint is a compile-time constant baked in at build time; this only needs to run once.
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePageHide = () => {
      void analyticsRef.current?.flush().catch((error: unknown) => {
        log.error("Failed to flush OpenTelemetry analytics on pagehide", error);
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>;
}
