// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { app } from "electron";
import fs from "fs";
import path from "path";

function getTelemetrySettings(): [crashReportingEnabled: boolean, telemetryEnabled: boolean] {
  const datastoreDir = path.join(app.getPath("userData"), "studio-datastores", "settings");
  const settingsPath = path.join(datastoreDir, "settings.json");
  let crashReportingEnabled = true;
  let telemetryEnabled = true;

  try {
    fs.mkdirSync(datastoreDir, { recursive: true });
  } catch {
    // Ignore directory creation errors, including dir already exists
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, { encoding: "utf8" }));
    crashReportingEnabled = settings["telemetry.crashReportingEnabled"] ?? true;
    telemetryEnabled = settings["telemetry.telemetryEnabled"] ?? true;
  } catch {
    // Ignore file load or parsing errors, including settings.json not existing
  }

  return [crashReportingEnabled, telemetryEnabled];
}

export { getTelemetrySettings };
