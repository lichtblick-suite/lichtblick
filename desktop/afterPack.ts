// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { exec } from "@actions/exec";
import { log, Arch } from "builder-util";
import { AfterPackContext } from "electron-builder";
import fs from "fs/promises";
import path from "path";
import plist, { PlistObject } from "plist";

export default async function afterPack(context: AfterPackContext): Promise<void> {
  await configureQuickLookExtension(context);
}

/**
 * Configure the .appex for Quick Look bag preview support. The appex itself is copied by
 * electron-builder as part of `extraFiles`.
 *
 * Here we perform the following steps:
 * - Update Info.plist to declare support for .bag file previews
 * - Copy the actual preview implementation (outputs from webpack.quicklook.config.ts)
 * - Re-codesign the app so it is properly sandboxed (macOS refuses to load an extension if it is
 *   not sandboxed)
 */
async function configureQuickLookExtension(context: AfterPackContext) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const appBundleId = context.packager.config.appId;

  const appexPath = path.join(appPath, "Contents", "PlugIns", "PreviewExtension.appex");
  const appexContents = path.join(appexPath, "Contents");
  const appexResources = path.join(appexContents, "Resources");
  const appexInfoPlist = path.join(appexContents, "Info.plist");
  const appexExecutablePath = path.join(appexContents, "MacOS", "PreviewExtension");

  const originalInfo = plist.parse(
    await fs.readFile(appexInfoPlist, { encoding: "utf-8" }),
  ) as PlistObject;
  const newInfo = {
    ...originalInfo,
    CFBundleIdentifier: `${appBundleId}.quicklook`,
    NSExtension: {
      ...(originalInfo.NSExtension as PlistObject),
      NSExtensionAttributes: {
        QLSupportedContentTypes: ["org.ros.bag"],
        QLSupportsSearchableItems: false,
      },
    },
  };
  await fs.writeFile(appexInfoPlist, plist.build(newInfo));
  log.info("Updated appex Info.plist for Quick Look");

  await fs.copyFile(
    path.join("desktop", ".webpack", "quicklook", "index.html"),
    path.join(appexResources, "preview.html"),
  );
  await fs.copyFile(
    path.join("desktop", ".webpack", "quicklook", "main.js"),
    path.join(appexResources, "main.js"),
  );
  log.info("Copied .webpack/quicklook into appex");

  // When building a universal app, electron-builder uses lipo to merge binaries at the same path.
  // Since quicklookjs already provides a universal binary, we need to strip out other architectures
  // so that lipo doesn't fail when it gets two copies of each slice.
  const arch = new Map([
    [Arch.arm64, "arm64"],
    [Arch.x64, "x86_64"],
  ]).get(context.arch);
  if (arch == undefined) {
    throw new Error(`Unsupported arch ${context.arch}`);
  }
  await exec("lipo", ["-extract", arch, appexExecutablePath, "-output", appexExecutablePath]);
  log.info(`Extracted ${arch} from appex executable`);

  await exec("codesign", [
    "--sign",
    "-",
    "--force",
    "--entitlements",
    path.join("node_modules", "quicklookjs", "dist", "PreviewExtension.entitlements"),
    appexPath,
  ]);
  log.info("Re-sandboxed appex");
}
