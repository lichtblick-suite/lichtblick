// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type OtelAnalytics from "@lichtblick/suite-base/services/telemetry/OtelAnalytics";

type OtelAnalyticsCtor = typeof OtelAnalytics;

let cachedModulePromise: Promise<OtelAnalyticsCtor> | undefined;

/**
 * Lazily loads the OtelAnalytics implementation via a dynamic import, keeping the OpenTelemetry
 * SDK out of the main bundle until telemetry is actually enabled.
 *
 * The dynamic import is memoized so the chunk is only fetched once even if this is called
 * multiple times (e.g. across AnalyticsProvider remounts). If the import fails, the cache is
 * cleared so a subsequent call can retry.
 */
export default async function loadOtelAnalytics(): Promise<OtelAnalyticsCtor> {
  cachedModulePromise ??= import("@lichtblick/suite-base/services/telemetry/OtelAnalytics")
    .then(({ default: OtelAnalyticsImpl }) => OtelAnalyticsImpl)
    .catch((error: unknown) => {
      cachedModulePromise = undefined;
      throw error;
    });

  return await cachedModulePromise;
}
