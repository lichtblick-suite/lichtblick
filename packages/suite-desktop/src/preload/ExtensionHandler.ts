// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { existsSync } from "fs";
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import JSZip from "jszip";
import { dirname, join as pathJoin } from "path";

import Logger from "@lichtblick/log";

import { ExtensionPackageJson, PackageName } from "./types";
import { DesktopExtension, LoadedExtension } from "../common/types";

export class ExtensionsHandler {
  private readonly log = Logger.getLogger(__filename);
  private readonly userExtensionsDir: string = "";
  private static readonly MAX_EXTENSION_DIR_LENGTH = 255;

  public constructor(userDir: string) {
    this.userExtensionsDir = userDir;
    this.log.debug("[extension]", `Using user directory: ${this.userExtensionsDir}`);
  }

  private static async safeReadFile(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, { encoding: "utf-8" });
    } catch {
      return "";
    }
  }

  /**
   * Returns a unique identifier for an extension based on the publisher and package name. The
   * publisher can either be explicitly specified with a "publisher" field or extracted from the
   * "name" field if it contains a namespace such as "@foxglove".
   *
   * This method will throw if any required fields are missing or invalid.
   * @param pkgJson Parsed package.json file
   * @returns An identifier string such as "lichtblick.suite-extension-turtlesim"
   */
  private static getPackageId(pkgJson: ExtensionPackageJson | undefined): string {
    if (pkgJson == undefined) {
      throw new Error(`Missing package.json`);
    }

    const { name, version, publisher } = pkgJson;

    if (typeof name !== "string") {
      throw new Error('package.json is missing required "name" field');
    }

    if (!name.trim()) {
      throw new Error('package.json "name" field cannot be empty');
    }

    if (typeof version !== "string") {
      throw new Error('package.json is missing required "version" field');
    }

    if (!version.trim()) {
      throw new Error('package.json "version" field cannot be empty');
    }

    const { name: parsedName, namespace } = ExtensionsHandler.parsePackageName(name);

    let extensionPublisher = publisher ?? namespace;
    if (extensionPublisher == undefined) {
      throw new Error(`package.json is missing required "publisher" field`);
    }

    extensionPublisher = extensionPublisher.toLowerCase().replace(/\W+/g, "");

    if (extensionPublisher.length === 0) {
      throw new Error(`package.json contains an invalid "publisher" field`);
    }

    return `${extensionPublisher}.${parsedName}`;
  }

  /**
   * Get the directory name to use for an installed extension
   * @param pkgJson Parsed package.json file
   * @returns A directory name such as "lichtblick.suite-extension-turtlesim-1.0.0"
   */
  private static getPackageDirname(pkgJson: ExtensionPackageJson): string {
    const pkgId = ExtensionsHandler.getPackageId(pkgJson);
    const dir = `${pkgId}-${pkgJson.version}`;
    if (dir.length >= this.MAX_EXTENSION_DIR_LENGTH) {
      throw new Error(`package.json publisher.name-version is too long`);
    }
    return dir;
  }

  /**
   * Separate a package.json "name" field into separate namespace (i.e. @foxglove) and name fields
   * @param name The "name" field from a package.json file
   * @returns An object containing the unprefixed name and the namespace, if present
   */
  private static parsePackageName(name: string): PackageName {
    const res = /^@([^/]+)\/(.+)/.exec(name);
    if (res == undefined) {
      return { name };
    }
    return { namespace: res[1], name: res[2]! };
  }

  public async get(id: string): Promise<DesktopExtension | undefined> {
    if (!existsSync(this.userExtensionsDir)) {
      return undefined;
    }

    const rootFolderContents = await readdir(this.userExtensionsDir, { withFileTypes: true });
    for (const entry of rootFolderContents) {
      if (!entry.isDirectory()) {
        continue;
      }

      const extensionRootPath = pathJoin(this.userExtensionsDir, entry.name);
      const packagePath = pathJoin(extensionRootPath, "package.json");

      try {
        const packageData = await readFile(packagePath, { encoding: "utf-8" });
        const packageJson = JSON.parse(packageData) as ExtensionPackageJson;

        if (ExtensionsHandler.getPackageId(packageJson) !== id) {
          continue;
        }

        const [readme, changelog] = await Promise.all([
          ExtensionsHandler.safeReadFile(pathJoin(extensionRootPath, "README.md")),
          ExtensionsHandler.safeReadFile(pathJoin(extensionRootPath, "CHANGELOG.md")),
        ]);

        return {
          id,
          packageJson,
          directory: extensionRootPath,
          readme,
          changelog,
        };
      } catch (err: unknown) {
        this.log.error("[extension]", `Failed to load from ${extensionRootPath}:`, err);
        continue;
      }
    }
    return undefined;
  }

  public async list(): Promise<DesktopExtension[]> {
    const extensions: DesktopExtension[] = [];
    if (!existsSync(this.userExtensionsDir)) {
      return extensions;
    }
    const rootFolderContents = await readdir(this.userExtensionsDir, { withFileTypes: true });
    for (const entry of rootFolderContents) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        const extensionRootPath = pathJoin(this.userExtensionsDir, entry.name);
        const packagePath = pathJoin(extensionRootPath, "package.json");
        const packageData = await readFile(packagePath, { encoding: "utf-8" });
        const packageJson = JSON.parse(packageData) as ExtensionPackageJson;
        const readmePath = pathJoin(extensionRootPath, "README.md");
        const changelogPath = pathJoin(extensionRootPath, "CHANGELOG.md");
        const [readme, changelog] = await Promise.all([
          ExtensionsHandler.safeReadFile(readmePath),
          ExtensionsHandler.safeReadFile(changelogPath),
        ]);

        const id = ExtensionsHandler.getPackageId(packageJson);

        extensions.push({ id, packageJson, directory: extensionRootPath, readme, changelog });
      } catch (err: unknown) {
        this.log.error("[extension]", err);
      }
    }

    return extensions;
  }

  public async load(id: string): Promise<LoadedExtension> {
    this.log.debug("[extension]", `Loading ${id}`);

    const extension = await this.get(id);
    if (!extension) {
      throw new Error(`Extension ${id} not found in ${this.userExtensionsDir}`);
    }
    const packagePath = pathJoin(extension.directory, "package.json");
    const packageData = await readFile(packagePath, { encoding: "utf-8" });
    const packageJson = JSON.parse(packageData) as ExtensionPackageJson;
    const sourcePath = pathJoin(extension.directory, packageJson.main);

    return { raw: await readFile(sourcePath, { encoding: "utf-8" }) };
  }

  public async install(foxeFileData: Uint8Array): Promise<DesktopExtension> {
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
    } catch (err: unknown) {
      this.log.error("[extension]", err);
      throw new Error(`Extension contains an invalid package.json`);
    }

    const readmeZipObj = archive.files["README.md"];
    const changelogZipObj = archive.files["CHANGELOG.md"];
    const readme = readmeZipObj ? await readmeZipObj.async("string") : "";
    const changelog = changelogZipObj ? await changelogZipObj.async("string") : "";

    // Check for basic validity of package.json and get the packageId
    const packageId = ExtensionsHandler.getPackageId(pkgJson);

    // Build the extension folder name based on package.json fields
    const dir = ExtensionsHandler.getPackageDirname(pkgJson);

    // Delete any previous installation and create the extension folder
    const extensionBaseDir = pathJoin(this.userExtensionsDir, dir);
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
      readme,
      changelog,
    };
  }

  public async uninstall(id: string): Promise<boolean> {
    this.log.debug("[extension]", `Uninstalling ${id}`);

    const extension = await this.get(id);

    if (!extension) {
      this.log.warn("[extension]", `Extension ${id} not found in ${this.userExtensionsDir}`);
      return false;
    }

    await rm(extension.directory, {
      recursive: true,
      force: true,
    });
    return true;
  }
}
