// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppSetting } from "@foxglove/studio-base/src/AppSetting";

import { getAppSetting } from "./settings";

export function getTelemetrySettings(): {
  crashReportingEnabled: boolean;
  telemetryEnabled: boolean;
} {
  const crashReportingEnabled = getAppSetting<boolean>(AppSetting.CRASH_REPORTING_ENABLED) ?? true;
  const telemetryEnabled = getAppSetting<boolean>(AppSetting.TELEMETRY_ENABLED) ?? true;

  return { crashReportingEnabled, telemetryEnabled };
}
