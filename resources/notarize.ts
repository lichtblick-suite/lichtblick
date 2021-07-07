// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { log } from "builder-util";
import type { AfterPackContext } from "electron-builder";
import { notarize } from "electron-notarize";

exports.default = async function (context: AfterPackContext) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const appId = context.packager.config.appId;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_KEY_ISSUER;

  if (appId == undefined) {
    log.warn({ reason: "'appId' missing from builder config" }, "skipped notarizing");
    return;
  }

  if (appleApiIssuer == undefined || appleApiKeyId == undefined) {
    log.warn(
      {
        reason: "'APPLE_API_KEY_ID' or 'APPLE_API_KEY_ISSUER' environment variables not set",
      },
      "skipped notarizing",
    );
    return;
  }

  log.info({ appPath, appleApiKeyId }, "notarizing");

  return await notarize({
    appBundleId: appId,
    appPath,
    appleApiKey: appleApiKeyId,
    appleApiIssuer,
  });
};
