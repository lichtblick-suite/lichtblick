// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { spawn } from "child_process";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, readFile, readdir, stat } from "fs/promises";
import JSZip from "jszip";
import ncp from "ncp";
import { homedir } from "os";
import { join, normalize, relative, sep } from "path";
import rimraf from "rimraf";
import { promisify } from "util";

import { info } from "./log";

const cpR = promisify(ncp);

export interface PackageManifest {
  name: string;
  publisher?: string;
  namespaceOrPublisher: string;
  version: string;
  main: string;
  files?: string[];
  scripts?: {
    "foxglove:prepublish"?: string;
  };
}

export interface PackageOptions {
  readonly cwd?: string;
  readonly packagePath?: string;
}

export interface InstallOptions {
  readonly cwd?: string;
}

enum FileType {
  File,
  Directory,
  FileOrDirectory,
}

export async function packageCommand(options: PackageOptions = {}): Promise<void> {
  const extensionPath = options.cwd ?? process.cwd();

  const pkg = await readManifest(extensionPath);

  await prepublish(extensionPath, pkg);

  const files = await collect(extensionPath, pkg);

  const packagePath = normalize(
    options.packagePath ?? join(extensionPath, getPackageDirname(pkg) + ".foxe"),
  );

  await writeFoxe(files, packagePath);
}

export async function installCommand(options: InstallOptions = {}): Promise<void> {
  const extensionPath = options.cwd ?? process.cwd();

  const pkg = await readManifest(extensionPath);

  await prepublish(extensionPath, pkg);

  const files = await collect(extensionPath, pkg);

  await install(files, extensionPath, pkg);
}

async function readManifest(extensionPath: string): Promise<PackageManifest> {
  const pkgPath = join(extensionPath, "package.json");
  let pkg: unknown;
  try {
    pkg = JSON.parse(await readFile(pkgPath, { encoding: "utf8" }));
  } catch (err) {
    throw new Error(`Failed to load ${pkgPath}: ${err}`);
  }

  const manifest = pkg as PackageManifest;
  if (typeof manifest.name !== "string") {
    throw new Error(`Missing required field "name" in ${pkgPath}`);
  }
  if (typeof manifest.version !== "string") {
    throw new Error(`Missing required field "version" in ${pkgPath}`);
  }
  if (typeof manifest.main !== "string") {
    throw new Error(`Missing required field "main" in ${pkgPath}`);
  }
  if (manifest.files != undefined && !Array.isArray(manifest.files)) {
    throw new Error(`Invalid "files" entry in ${pkgPath}`);
  }

  const publisher = manifest.publisher ?? parsePackageName(manifest.name).namespace;
  if (publisher == undefined || publisher.length === 0) {
    throw new Error(`Unknown publisher, add a "publisher" field to package.json`);
  }
  manifest.namespaceOrPublisher = publisher;

  return manifest;
}

async function prepublish(extensionPath: string, pkg: PackageManifest): Promise<void> {
  const script = pkg.scripts?.["foxglove:prepublish"];
  if (script == undefined) {
    return;
  }

  info(`Executing prepublish script 'yarn run foxglove:prepublish'...`);

  await new Promise<void>((c, e) => {
    const tool = "yarn";
    const cwd = extensionPath;
    const child = spawn(tool, ["run", "foxglove:prepublish"], {
      cwd,
      shell: true,
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? c() : e(`${tool} failed with exit code ${code}`)));
    child.on("error", e);
  });
}

async function collect(extensionPath: string, pkg: PackageManifest): Promise<string[]> {
  const files = new Set<string>();

  const baseFiles = [
    join(extensionPath, "package.json"),
    join(extensionPath, "README.md"),
    join(extensionPath, "CHANGELOG.md"),
    join(extensionPath, pkg.main),
  ];

  for (const file of baseFiles) {
    if (!(await pathExists(file, FileType.File))) {
      throw new Error(`Missing required file ${file}`);
    }
    files.add(file);
  }

  if (pkg.files != undefined) {
    for (const relFile of pkg.files) {
      const file = join(extensionPath, relFile);
      if (!inDirectory(extensionPath, file)) {
        throw new Error(`File ${file} is outside of the extension directory`);
      }
      if (!(await pathExists(file, FileType.FileOrDirectory))) {
        throw new Error(`Missing required path ${file}`);
      }
      files.add(file);
    }
  } else {
    const distDir = join(extensionPath, "dist");
    if (!(await pathExists(distDir, FileType.Directory))) {
      throw new Error(`Missing required directory ${distDir}`);
    }
    files.add(distDir);
  }

  return Array.from(files.values())
    .map((f) => relative(extensionPath, f))
    .sort();
}

async function writeFoxe(files: string[], outputFile: string): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    if (await isDirectory(file)) {
      await addDirToZip(zip, file);
    } else {
      addFileToZip(zip, file);
    }
  }

  info(`Archiving files into ${outputFile}`);
  return new Promise((c, e) => {
    zip
      .generateNodeStream({ type: "nodebuffer", streamFiles: true })
      .pipe(createWriteStream(outputFile, { encoding: "binary" }) as NodeJS.WritableStream)
      .on("error", e)
      .on("finish", c);
  });
}

async function install(
  files: string[],
  extensionPath: string,
  pkg: PackageManifest,
): Promise<void> {
  process.chdir(extensionPath);

  const dirName = getPackageDirname(pkg);
  const destDir = join(homedir(), ".foxglove-studio", "extensions", dirName);

  await rmdir(destDir);
  await mkdir(destDir, { recursive: true });

  info(`Copying files to ${destDir}`);
  for (const file of files) {
    const target = join(destDir, file);
    info(`${file} -> ${target}`);
    await cpR(file, target, { stopOnErr: true });
  }
}

async function pathExists(filename: string, fileType: FileType): Promise<boolean> {
  try {
    const finfo = await stat(filename);
    switch (fileType) {
      case FileType.File:
        return finfo.isFile();
      case FileType.Directory:
        return finfo.isDirectory();
      case FileType.FileOrDirectory:
        return finfo.isFile() || finfo.isDirectory();
    }
  } catch {
    // ignore
  }
  return false;
}

async function isDirectory(pathname: string): Promise<boolean> {
  return (await stat(pathname)).isDirectory();
}

function rmdir(dirname: string): Promise<void> {
  return new Promise<void>((c, e) => rimraf(dirname, (err) => (err != undefined ? e(err) : c())));
}

async function addDirToZip(zip: JSZip, dirname: string): Promise<void> {
  const entries = await readdir(dirname, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(dirname, entry.name);
    if (entry.isFile()) {
      addFileToZip(zip, entryPath);
    } else if (entry.isDirectory()) {
      await addDirToZip(zip, entryPath);
    }
  }
}

function addFileToZip(zip: JSZip, filename: string) {
  zip.file<"stream">(filename, createReadStream(filename), { createFolders: true });
}

function getPackageDirname(pkg: PackageManifest): string {
  const pkgName = parsePackageName(pkg.name);
  return `${pkg.namespaceOrPublisher}.${pkgName.name}-${pkg.version}`;
}

function parsePackageName(name: string): { namespace?: string; name: string } {
  const res = /^@([^/]+)\/(.+)/.exec(name);
  if (res == undefined) {
    return { name };
  }
  return { namespace: res[1], name: res[2] as string };
}

function inDirectory(directory: string, pathname: string): boolean {
  const relPath = relative(directory, pathname);
  const parts = relPath.split(sep);
  return parts[0] !== "..";
}
