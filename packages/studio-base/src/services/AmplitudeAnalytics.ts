// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { setUser as setSentryUser, addBreadcrumb as addSentryBreadcrumb } from "@sentry/core";
import { Severity } from "@sentry/types";
import amplitude, { AmplitudeClient } from "amplitude-js";

import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { User } from "@foxglove/studio-base/context/CurrentUserContext";
import IAnalytics, {
  AppEvent,
  getEventBreadcrumbType,
  getEventCategory,
} from "@foxglove/studio-base/services/IAnalytics";

const os = OsContextSingleton; // workaround for https://github.com/webpack/webpack/issues/12960

export class AmplitudeAnalytics implements IAnalytics {
  private _amp?: AmplitudeClient;

  constructor(options: { enableTelemetry: boolean; amplitudeApiKey?: string }) {
    if (options.amplitudeApiKey) {
      this._amp = amplitude.getInstance();

      // Capitalize platform name
      let platform = os?.platform ?? "web";
      platform = platform.charAt(0).toUpperCase() + platform.slice(1);

      this._amp.init(options.amplitudeApiKey, undefined, {
        platform,
      });

      this._amp.setOptOut(!options.enableTelemetry);

      if (os) {
        this._amp.setVersionName(os.getAppVersion());
      }

      void this.logEvent(AppEvent.APP_INIT);
    }
  }

  setUser(user?: User): void {
    // Amplitude will continue to associate events with the last signed in user for this deviceId.
    // It is possible to call regenerateDeviceId() after sign out, but this means future events
    // will appear as a new unique user. We also don't want to call regenerateDeviceId() every time
    // AnalyticsProvider is mounted for anonymous users.
    // https://help.amplitude.com/hc/en-us/articles/115003135607-Tracking-unique-users
    this._amp?.setUserId(user?.id ?? null); // eslint-disable-line no-restricted-syntax

    // Update Sentry user, passing Amplitude deviceId
    setSentryUser({ id: user?.id, device_id: this._amp?.options.deviceId });
  }

  async logEvent(event: AppEvent, data?: { [key: string]: unknown }): Promise<void> {
    addSentryBreadcrumb({
      type: getEventBreadcrumbType(event),
      category: `studio.${getEventCategory(event).toLowerCase()}`,
      message: event,
      level: Severity.Info,
      data,
      timestamp: Date.now() / 1000,
    });

    await new Promise<void>((resolve) => {
      if (this._amp) {
        this._amp.logEvent(event, data, () => resolve());
      } else {
        resolve();
      }
    });
  }
}
