// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { captureException } from "@sentry/electron/main";
import { autoUpdater } from "electron-updater";

import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/src/AppSetting";

import { getAppSetting } from "./settings";

const log = Logger.getLogger(__filename);

function isNetworkError(err: unknown) {
  if (!(err instanceof Error)) {
    return false;
  }

  return (
    err.message === "net::ERR_INTERNET_DISCONNECTED" ||
    err.message === "net::ERR_PROXY_CONNECTION_FAILED" ||
    err.message === "net::ERR_CONNECTION_RESET" ||
    err.message === "net::ERR_CONNECTION_CLOSE" ||
    err.message === "net::ERR_NAME_NOT_RESOLVED" ||
    err.message === "net::ERR_CONNECTION_TIMED_OUT"
  );
}

class StudioAppUpdater {
  private started: boolean = false;
  // Seconds to wait after app startup to check and download updates.
  // This gives the user time to disable app updates for new installations
  private initialUpdateDelaySec = 60 * 10;

  // Seconds to wait after an update check completes before starting a new check
  private updateCheckIntervalSec = 60 * 60;

  /**
   * Start the update process.
   */
  public start(): void {
    if (this.started) {
      log.info(`StudioAppUpdater already running`);
      return;
    }
    this.started = true;

    log.info(`Starting update loop`);
    setTimeout(() => {
      void this.maybeCheckForUpdates();
    }, this.initialUpdateDelaySec * 1000);
  }

  // Check for updates and download.
  //
  // When using the "default" update mode, the app will continue to check for updates periodically
  private async maybeCheckForUpdates(): Promise<void> {
    try {
      // The user may have changed the app update setting so we load it again
      const appUpdatesEnabled = getAppSetting<boolean>(AppSetting.UPDATES_ENABLED);

      if (appUpdatesEnabled ?? true) {
        log.info("Checking for updates");
        await autoUpdater.checkForUpdatesAndNotify();
      }
    } catch (err) {
      if (isNetworkError(err)) {
        log.warn(`Network error checking for updates: ${err}`);
      } else {
        captureException(err);
      }
    } finally {
      setTimeout(() => {
        void this.maybeCheckForUpdates();
      }, this.updateCheckIntervalSec * 1000);
    }
  }

  private static instance: StudioAppUpdater;
  public static Instance(): StudioAppUpdater {
    return (StudioAppUpdater.instance ??= new StudioAppUpdater());
  }
}

export default StudioAppUpdater;
