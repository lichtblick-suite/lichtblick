// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { exec } from "@actions/exec";
import { downloadTool, extractZip } from "@actions/tool-cache";
import type MacPackager from "app-builder-lib/out/macPackager";
import { log, Arch } from "builder-util";
import crypto from "crypto";
import { AfterPackContext } from "electron-builder";
import fs from "fs/promises";
import path from "path";
import plist, { PlistObject } from "plist";

async function getKeychainFile(context: AfterPackContext): Promise<string | undefined> {
  const macPackager = context.packager as MacPackager;
  if ((macPackager as Partial<typeof macPackager>).codeSigningInfo == undefined) {
    log.error("No code signing info available.");
    return;
  }
  return (await macPackager.codeSigningInfo.value).keychainFile ?? undefined;
}

export default async function afterPack(context: AfterPackContext): Promise<void> {
  await configureQuickLookExtension(context);
  await copySpotlightImporter(context);
}

/**
 * When building a universal app, electron-builder uses lipo to merge binaries at the same path.
 * Since our bundled Quick Look and Spotlight extensions already provide universal binaries, we need
 * to strip out other architectures so that lipo doesn't fail when it gets two copies of each slice.
 */
async function extractTargetArchitecture(executablePath: string, context: AfterPackContext) {
  const arch = new Map([
    [Arch.arm64, "arm64"],
    [Arch.x64, "x86_64"],
    [Arch.universal, "universal"],
  ]).get(context.arch);
  if (arch == undefined) {
    throw new Error(`Unsupported arch ${context.arch}`);
  }
  if (arch !== "universal") {
    await exec("lipo", ["-extract", arch, executablePath, "-output", executablePath]);
    log.info({ executablePath }, `Extracted ${arch} from universal executable`);
  }
}

/**
 * Download the Spotlight importer for MCAP files and include it in the app bundle.
 */
async function copySpotlightImporter(context: AfterPackContext) {
  const { electronPlatformName, outDir, appOutDir } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const spotlightDirPath = path.join(appPath, "Contents", "Library", "Spotlight");
  const zipPath = path.join(outDir, "MCAPSpotlightImporter.mdimporter.zip");
  await fs.unlink(zipPath).catch(() => {});

  const zipURL =
    "https://github.com/foxglove/MCAPSpotlightImporter/releases/download/v1.0.2/MCAPSpotlightImporter.mdimporter.zip";
  const zipSHA = "26cafa3e3069fcbd294864ceeee1bc9899e94456e0d28079f966787b6f05c7a2";
  await downloadTool(zipURL, zipPath);
  const actualSHA = crypto
    .createHash("sha256")
    .update(await fs.readFile(zipPath))
    .digest("hex");
  if (actualSHA !== zipSHA) {
    throw new Error(`SHA mismatch for ${zipURL}: expected ${zipSHA}, got ${actualSHA}`);
  }
  try {
    await extractZip(zipPath, spotlightDirPath);
    const executablePath = path.join(
      spotlightDirPath,
      "MCAPSpotlightImporter.mdimporter",
      "Contents",
      "MacOS",
      "MCAPSpotlightImporter",
    );
    await extractTargetArchitecture(executablePath, context);
  } finally {
    await fs.unlink(zipPath).catch((err: Error) => {
      log.error(err.toString());
    });
  }
  log.info({ path: spotlightDirPath }, "Copied mdimporter");
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
        QLSupportedContentTypes: ["org.ros.bag", "dev.mcap.mcap"],
        QLSupportsSearchableItems: false,
      },
    },
    QLJS: {
      ...(originalInfo.QLJS as PlistObject),
      pagePath: "index.html",
    },
  };
  await fs.writeFile(appexInfoPlist, plist.build(newInfo));
  log.info("Updated appex Info.plist for Quick Look");

  const webpackOutputDir = path.join(context.packager.info.appDir, "quicklook");
  for (const file of await fs.readdir(webpackOutputDir, { withFileTypes: true })) {
    if (!file.isFile()) {
      throw new Error(`Expected only files in Quick Look webpack output, found: ${file.name}`);
    }
    await fs.copyFile(path.join(webpackOutputDir, file.name), path.join(appexResources, file.name));
  }
  log.info("Copied .webpack/quicklook into appex resources");

  await extractTargetArchitecture(appexExecutablePath, context);

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
    path.join(require.resolve("quicklookjs/index.d.ts"), "../dist/PreviewExtension.entitlements"),
    appexPath,
  ]);
  log.info("Re-sandboxed appex");
}
