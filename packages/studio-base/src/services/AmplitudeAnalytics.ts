// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { setUser as setSentryUser, addBreadcrumb as addSentryBreadcrumb } from "@sentry/core";
import amplitude, { AmplitudeClient } from "amplitude-js";
import moment from "moment";

import Logger from "@foxglove/log";
import OsContextSingleton from "@foxglove/studio-base/OsContextSingleton";
import { User } from "@foxglove/studio-base/context/CurrentUserContext";
import IAnalytics, {
  AppEvent,
  getEventBreadcrumbType,
  getEventCategory,
} from "@foxglove/studio-base/services/IAnalytics";

const log = Logger.getLogger("Analytics");

export class AmplitudeAnalytics implements IAnalytics {
  private _amp?: AmplitudeClient;

  public constructor(options: { enableTelemetry: boolean; amplitudeApiKey?: string }) {
    const platform = getPlatformName();
    const appVersion = OsContextSingleton?.getAppVersion();
    const { glVendor, glRenderer } = getWebGLInfo() ?? {
      glVendor: "(unknown)",
      glRenderer: "(unknown)",
    };

    log.info(
      `[APP_INIT] ${platform}${
        appVersion ? ` v${appVersion}` : ""
      }, GL Vendor: ${glVendor}, GL Renderer: ${glRenderer}`,
    );

    if (options.amplitudeApiKey) {
      this._amp = amplitude.getInstance();

      this._amp.init(options.amplitudeApiKey, undefined, {
        platform,
      });

      this._amp.setOptOut(!options.enableTelemetry);

      if (appVersion) {
        this._amp.setVersionName(appVersion);
      }

      // use setOnce() to set first seen cohort for new users
      const identify = new amplitude.Identify();
      identify.setOnce("first_seen_date", moment.utc().format("YYYY-MM-DD"));
      identify.setOnce("first_seen_month", moment.utc().format("YYYY-MM"));
      identify.setOnce("first_seen_year", moment.utc().format("YYYY"));
      this._amp.identify(identify);

      void this.logEvent(AppEvent.APP_INIT, { glVendor, glRenderer });
    }
  }

  public setUser(user?: User): void {
    // Amplitude will continue to associate events with the last signed in user for this deviceId.
    // It is possible to call regenerateDeviceId() after sign out, but this means future events
    // will appear as a new unique user. We also don't want to call regenerateDeviceId() every time
    // AnalyticsProvider is mounted for anonymous users.
    // https://help.amplitude.com/hc/en-us/articles/115003135607-Tracking-unique-users
    this._amp?.setUserId(user?.id ?? null); // eslint-disable-line no-restricted-syntax

    // Update Sentry user, passing Amplitude deviceId
    setSentryUser({ id: user?.id, device_id: this._amp?.options.deviceId });
  }

  public async logEvent(event: AppEvent, data?: { [key: string]: unknown }): Promise<void> {
    addSentryBreadcrumb({
      type: getEventBreadcrumbType(event),
      category: `studio.${getEventCategory(event).toLowerCase()}`,
      message: event,
      level: "info",
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

function getPlatformName(): string {
  const platform = OsContextSingleton?.platform ?? "web";
  switch (platform) {
    case "darwin":
      return "macOS";
      break;
    case "win32":
      return "Windows";
      break;
    default:
      return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
  }
}

function getWebGLInfo(): { glVendor: string; glRenderer: string } | undefined {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    canvas.remove();
    return undefined;
  }

  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const res = debugInfo
    ? {
        glVendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        glRenderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
      }
    : undefined;

  canvas.remove();
  return res;
}
