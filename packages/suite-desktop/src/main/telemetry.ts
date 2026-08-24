// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@lichtblick/suite-base/src/AppSetting";

import { getAppSetting } from "./settings";

export function getTelemetrySettings(): {
  crashReportingEnabled: boolean;
  telemetryEnabled: boolean;
} {
  // Fail closed, matching the renderer's TelemetryProvider: an absent setting means the user never
  // opted in, so it must read as disabled. Defaulting to `true` here also made the two processes
  // disagree — the main process considered itself enabled while the renderer stayed silent.
  const crashReportingEnabled = getAppSetting<boolean>(AppSetting.CRASH_REPORTING_ENABLED) ?? false;
  const telemetryEnabled = getAppSetting<boolean>(AppSetting.TELEMETRY_ENABLED) ?? false;

  return { crashReportingEnabled, telemetryEnabled };
}
