// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { exec } from "@actions/exec";
import type MacPackager from "app-builder-lib/out/macPackager";
import { log, Arch } from "builder-util";
import { AfterPackContext } from "electron-builder";
import fs from "fs/promises";
import path from "path";
import plist, { PlistObject } from "plist";

async function getKeychainFile(context: AfterPackContext): Promise<string | undefined> {
  const macPackager = context.packager as MacPackager;
  if (macPackager.codeSigningInfo == undefined) {
    log.error("No code signing info available.");
    return;
  }
  return (await macPackager.codeSigningInfo.value).keychainFile ?? undefined;
}

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
        QLSupportedContentTypes: ["org.ros.bag", "dev.foxglove.mcap"],
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

  // The notarization step requires a valid signature from our "Developer ID Application"
  // certificate. However this certificate is only available in CI, so for packaging to succeed in a
  // local development workflow, we just use the "-" ad-hoc signing identity.
  //
  // electron-builder's MacPackager creates a temporary keychain to hold the signing info. The
  // certificate is not in the regular system keychain so we have to use the temporary keychain for
  // signing.
  const keychainFile = await getKeychainFile(context);
  if (keychainFile != undefined) {
    await exec("security", ["find-identity", "-v", "-p", "codesigning", keychainFile]);
  }
  const signingArgs =
    process.env.CI != undefined && keychainFile != undefined
      ? ["--keychain", keychainFile, "--sign", "Developer ID Application"]
      : ["--sign", "-"];

  await exec("codesign", [
    ...signingArgs,
    "--force",
    "--options",
    "runtime", // notarization requires Hardened Runtime to be enabled
    "--entitlements",
    path.join("node_modules", "quicklookjs", "dist", "PreviewExtension.entitlements"),
    appexPath,
  ]);
  log.info("Re-sandboxed appex");
}
