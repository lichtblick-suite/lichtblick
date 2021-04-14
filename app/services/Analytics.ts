// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { addBreadcrumb, setUser, Severity } from "@sentry/electron";
import amplitude from "amplitude-js";
import { v4 as uuidv4 } from "uuid";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import Storage from "@foxglove-studio/app/util/Storage";
import Logger from "@foxglove/log";

const UUID_ZERO = "00000000-0000-0000-0000-000000000000";
const USER_ID_KEY = "analytics_user_id";

const log = Logger.getLogger(__filename);

export enum AppEvent {
  APP_INIT = "APP_INIT",

  // PlayerMetricsCollectorInterface events
  PLAYER_CONSTRUCTED = "PLAYER_CONSTRUCTED",
  PLAYER_INITIALIZED = "PLAYER_INITIALIZED",
  PLAYER_PLAY = "PLAYER_PLAY",
  PLAYER_SEEK = "PLAYER_SEEK",
  PLAYER_SET_SPEED = "PLAYER_SET_SPEED",
  PLAYER_PAUSE = "PLAYER_PAUSE",
  PLAYER_CLOSE = "PLAYER_CLOSE",
}

export class Analytics {
  private _amplitude?: amplitude.AmplitudeClient;
  private _crashReporting: boolean;
  private _storage = new Storage();

  constructor(options: {
    optOut?: boolean;
    crashReportingOptOut: boolean;
    amplitudeApiKey: string | undefined;
  }) {
    const amplitudeApiKey = options.amplitudeApiKey;
    const optOut = options.optOut ?? false;
    this._crashReporting = !(options.crashReportingOptOut ?? false);
    if (!optOut && amplitudeApiKey != undefined && amplitudeApiKey.length > 0) {
      const userId = this.getUserId();
      const deviceId = this.getDeviceId();
      const appVersion = this.getAppVersion();
      log.info(
        `Initializing telemetry as user ${userId}, device ${deviceId} (version ${appVersion})`,
      );
      this._amplitude = amplitude.getInstance();
      this._amplitude.init(amplitudeApiKey);
      this._amplitude.setUserId(userId);
      this._amplitude.setDeviceId(deviceId);
      this._amplitude.setVersionName(appVersion);
      this._amplitude.logEvent(AppEvent.APP_INIT);
    } else {
      log.info("Telemetry is disabled");
    }

    if (this._crashReporting) {
      const id = this.getUserId();
      const deviceId = this.getDeviceId();
      setUser({ id, deviceId });
    } else {
      log.info("Crash reporting is disabled");
    }
  }

  getAppVersion(): string {
    return OsContextSingleton?.getAppVersion() ?? "0.0.0";
  }

  getUserId(): string {
    let userId = this._storage.getItem<string>(USER_ID_KEY);
    if (userId == undefined) {
      userId = uuidv4();
      this._storage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  }

  getDeviceId(): string {
    return OsContextSingleton?.getMachineId() ?? UUID_ZERO;
  }

  async logEvent(event: AppEvent, data?: { [key: string]: unknown }): Promise<void> {
    if (this._crashReporting) {
      addBreadcrumb({
        type: "user",
        category: event,
        level: Severity.Info,
        data,
        timestamp: Date.now() / 1000,
      });
    }

    return new Promise((resolve) => {
      if (this._amplitude == undefined) {
        return resolve();
      }
      this._amplitude.logEvent(event, data, () => resolve());
    });
  }
}
