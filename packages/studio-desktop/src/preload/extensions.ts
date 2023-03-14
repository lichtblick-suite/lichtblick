// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { existsSync } from "fs";
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import JSZip from "jszip";
import { dirname, join as pathJoin } from "path";

import Logger from "@foxglove/log";

import { DesktopExtension } from "../common/types";

const log = Logger.getLogger(__filename);

type ExtensionPackageJson = { name: string; version: string; main: string; publisher?: string };

/**
 * Returns a unique identifier for an extension based on the publisher and package name. The
 * publisher can either be explicitly specified with a "publisher" field or extracted from the
 * "name" field if it contains a namespace such as "@foxglove".
 *
 * This method will throw if any required fields are missing or invalid.
 * @param pkgJson Parsed package.json file
 * @returns An identifier string such as "foxglove.studio-extension-turtlesim"
 */
function getPackageId(pkgJson: undefined | ExtensionPackageJson): string {
  if (pkgJson == undefined) {
    throw new Error(`Missing package.json`);
  }

  if (typeof pkgJson.name !== "string") {
    throw new Error(`package.json is missing required "name" field`);
  }
  if (typeof pkgJson.version !== "string") {
    throw new Error(`package.json is missing required "version" field`);
  }

  const pkgName = parsePackageName(pkgJson.name);
  let publisher = pkgJson.publisher ?? pkgName.namespace;
  if (publisher == undefined) {
    throw new Error(`package.json is missing required "publisher" field`);
  }

  publisher = publisher.toLowerCase().replace(/\W+/g, "");
  if (publisher.length === 0) {
    throw new Error(`package.json contains an invalid "publisher" field`);
  }

  return `${publisher}.${pkgName.name}`;
}

/**
 * Get the directory name to use for an installed extension
 * @param pkgJson Parsed package.json file
 * @returns A directory name such as "foxglove.studio-extension-turtlesim-1.0.0"
 */
function getPackageDirname(pkgJson: ExtensionPackageJson): string {
  const pkgId = getPackageId(pkgJson);
  const dir = `${pkgId}-${pkgJson.version}`;
  if (dir.length >= 255) {
    throw new Error(`package.json publisher.name-version is too long`);
  }
  return dir;
}

/**
 * Separate a package.json "name" field into separate namespace (i.e. @foxglove) and name fields
 * @param name The "name" field from a package.json file
 * @returns An object containing the unprefixed name and the namespace, if present
 */
function parsePackageName(name: string): { namespace?: string; name: string } {
  const res = /^@([^/]+)\/(.+)/.exec(name);
  if (res == undefined) {
    return { name };
  }
  return { namespace: res[1], name: res[2] as string };
}

export async function getExtensions(rootFolder: string): Promise<DesktopExtension[]> {
  const extensions: DesktopExtension[] = [];

  if (!existsSync(rootFolder)) {
    return extensions;
  }

  const rootFolderContents = await readdir(rootFolder, { withFileTypes: true });
  for (const entry of rootFolderContents) {
    if (!entry.isDirectory()) {
      continue;
    }
    try {
      log.debug(`Loading extension at ${entry.name}`);
      const extensionRootPath = pathJoin(rootFolder, entry.name);
      const packagePath = pathJoin(extensionRootPath, "package.json");
      const packageData = await readFile(packagePath, { encoding: "utf8" });
      const packageJson = JSON.parse(packageData) as ExtensionPackageJson;

      const id = getPackageId(packageJson);

      extensions.push({ id, packageJson, directory: extensionRootPath });
    } catch (err) {
      log.error(err);
    }
  }

  return extensions;
}

export async function loadExtension(id: string, rootFolder: string): Promise<string> {
  // Find this extension
  const userExtensions = await getExtensions(rootFolder);
  const extension = userExtensions.find(
    (ext) => getPackageId(ext.packageJson as ExtensionPackageJson) === id,
  );
  if (extension == undefined) {
    log.error(`Extension ${id} was not found, searched ${userExtensions.length} extensions`);
    return "";
  }

  const packagePath = pathJoin(extension.directory, "package.json");
  const packageData = await readFile(packagePath, { encoding: "utf8" });
  const packageJson = JSON.parse(packageData) as ExtensionPackageJson;
  const sourcePath = pathJoin(extension.directory, packageJson.main);
  return await readFile(sourcePath, { encoding: "utf-8" });
}

export async function installExtension(
  foxeFileData: Uint8Array,
  rootFolder: string,
): Promise<DesktopExtension> {
  // Open the archive
  const archive = await JSZip.loadAsync(foxeFileData);

  // Check for a package.json file
  const pkgJsonZipObj = archive.files["package.json"];
  if (pkgJsonZipObj == undefined) {
    throw new Error(`Extension does not contain a package.json file`);
  }

  // Unpack and parse the package.json file
  let pkgJson: ExtensionPackageJson;
  try {
    pkgJson = JSON.parse(await pkgJsonZipObj.async("string"));
  } catch (err) {
    log.error(err);
    throw new Error(`Extension contains an invalid package.json`);
  }

  // Check for basic validity of package.json and get the packageId
  const packageId = getPackageId(pkgJson);

  // Build the extension folder name based on package.json fields
  const dir = getPackageDirname(pkgJson);

  // Delete any previous installation and create the extension folder
  const extensionBaseDir = pathJoin(rootFolder, dir);
  await rm(extensionBaseDir, { recursive: true, force: true });
  await mkdir(extensionBaseDir, { recursive: true });

  // Unpack all files into the extension folder
  for (const [relPath, zipObj] of Object.entries(archive.files)) {
    const filePath = pathJoin(extensionBaseDir, relPath);
    if (zipObj.dir) {
      await mkdir(dirname(filePath), { recursive: true });
    } else {
      const fileData = await zipObj.async("uint8array");
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, fileData);
    }
  }

  return {
    id: packageId,
    packageJson: pkgJson,
    directory: extensionBaseDir,
  };
}

export async function uninstallExtension(id: string, rootFolder: string): Promise<boolean> {
  log.debug(`Searching for extension ${id} in ${rootFolder} to uninstall`);

  // Find this extension
  const userExtensions = await getExtensions(rootFolder);
  const extension = userExtensions.find(
    (ext) => getPackageId(ext.packageJson as ExtensionPackageJson) === id,
  );
  if (extension == undefined) {
    log.error(`Extension ${id} was not found, searched ${userExtensions.length} extensions`);
    return false;
  }

  // Delete the extension directory and contents
  log.info(`Deleting extension directory ${extension.directory}`);
  await rm(extension.directory, { recursive: true, force: true });
  return true;
}
