// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { app } from "electron";
import fs from "fs";
import path from "path";

import { AppSetting } from "@foxglove/studio-base/src/AppSetting";

import {
  DATASTORES_DIR_NAME,
  SETTINGS_DATASTORE_NAME,
  SETTINGS_JSON_DATASTORE_KEY,
} from "../common/storage";

export function getAppSetting<T>(key: AppSetting): T | undefined {
  const datastoreDir = path.join(
    app.getPath("userData"),
    DATASTORES_DIR_NAME,
    SETTINGS_DATASTORE_NAME,
  );
  const settingsPath = path.join(datastoreDir, SETTINGS_JSON_DATASTORE_KEY);

  try {
    fs.mkdirSync(datastoreDir, { recursive: true });
  } catch {
    // Ignore directory creation errors, including dir already exists
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, { encoding: "utf8" }));
    return settings[key];
  } catch {
    // Ignore file load or parsing errors, including settings.json not existing
    return undefined;
  }
}

export function setAppSetting(key: AppSetting, value: unknown): void {
  const datastoreDir = path.join(
    app.getPath("userData"),
    DATASTORES_DIR_NAME,
    SETTINGS_DATASTORE_NAME,
  );
  const settingsPath = path.join(datastoreDir, SETTINGS_JSON_DATASTORE_KEY);

  const existingSettings = {};
  try {
    fs.mkdirSync(datastoreDir, { recursive: true });
  } catch {
    // Ignore directory creation errors, including dir already exists
  }

  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ ...existingSettings, [key]: value }, undefined, 2),
  );
}
