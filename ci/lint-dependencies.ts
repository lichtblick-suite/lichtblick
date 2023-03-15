// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { info, warning, error } from "@actions/core";
import depcheck, { Detector } from "depcheck";
import glob from "glob";
import path from "path";
import { promisify } from "util";

/**
 * Detect comments of the form
 * // foxglove-depcheck-used: ..., ...
 */
const commentDetector: Detector = (node) => {
  const results: string[] = [];
  if (node.type === "CommentBlock" || node.type === "CommentLine") {
    for (const match of (node.value as string).matchAll(
      /foxglove-depcheck-used: ([@/\w\-_,\s]+)/g,
    )) {
      results.push(...match[1]!.split(/[,\s]+/));
    }
  }
  return results;
};

/**
 * Detect TypeScript triple slash references
 */
const tripleSlashDetector: Detector = (node) => {
  const results: string[] = [];
  if (node.type === "CommentLine") {
    for (const match of (node.value as string).matchAll(/^\/ <reference types="(.+)" \/>/g)) {
      results.push(match[1]!);
    }
  }
  return results;
};

async function run(rootPath: string) {
  info(`Linting dependencies in ${rootPath}...`);
  const options: depcheck.Options = {
    detectors: [...Object.values(depcheck.detector), commentDetector, tripleSlashDetector],
  };
  return await depcheck(rootPath, options);
}

function printAndAnalyzeResults(unused: depcheck.Results, packageName: string) {
  let hadError = false;

  if (unused.devDependencies.length > 0) {
    hadError = true;

    error(`Unused devDependencies in ${packageName}:`);
    for (const dep of unused.devDependencies) {
      info(`- ${dep}`);
    }
    info("");
  }

  if (unused.dependencies.length > 0) {
    hadError = true;
    error(`Unused dependencies in ${packageName}:`);
    for (const dep of unused.dependencies) {
      info(`- ${dep}`);
    }
    info("");
  }

  // Don't consider the package itself to be a missing dep
  // https://github.com/depcheck/depcheck/issues/564
  delete unused.missing[packageName];

  if (Object.keys(unused.missing).length > 0) {
    hadError = true;
    error(`Missing dependencies in ${packageName}:`);
    for (const [dep, locations] of Object.entries(unused.missing)) {
      info(`- ${dep} (used in ${locations[0]!})`);
    }
    info("");
  }

  if (Object.keys(unused.invalidFiles).length > 0) {
    hadError = true;
    error(`Invalid files in ${packageName}:`);
    for (const [filePath, err] of Object.entries(unused.invalidFiles)) {
      info(`- ${filePath} (${err})`);
    }
    info("");
  }

  if (Object.keys(unused.invalidDirs).length > 0) {
    hadError = true;
    error(`Invalid directories in ${packageName}:`);
    for (const [dirPath, err] of Object.entries(unused.invalidDirs)) {
      info(`- ${dirPath} (${err})`);
    }
    info("");
  }

  if (!hadError) {
    info(`No missing or unused dependencies in ${packageName}!`);
    info("");
  }

  return !hadError;
}

async function getAllWorkspacePackages(roots: string[]) {
  const results: { name: string; path: string }[] = [];
  const workspacePackages: string[] = [];
  for (const workspaceRoot of roots) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const workspaceInfo = require(path.resolve(process.cwd(), workspaceRoot, "package.json"));
    const patterns: string[] = Array.isArray(workspaceInfo.workspaces)
      ? workspaceInfo.workspaces
      : Array.isArray(workspaceInfo.workspaces?.packages)
      ? workspaceInfo.workspaces.packages
      : [];
    for (const pattern of patterns) {
      for (const packagePath of await promisify(glob)(pattern)) {
        workspacePackages.push(path.resolve(process.cwd(), workspaceRoot, packagePath));
      }
    }
  }
  for (const packagePath of workspacePackages) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const packageInfo = require(path.join(packagePath, "package.json"));
      const name = packageInfo.name;
      if (typeof name !== "string") {
        warning(`No name in package.json at ${packagePath}`);
        continue;
      }
      if (name.startsWith("@types/")) {
        info(`Skipping types package ${name}`);
        continue;
      }
      results.push({ path: packagePath, name });
    } catch (err) {
      // skip directories without package.json
    }
  }
  return results;
}

async function main() {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    error("Usage: lint-dependencies [workspace1] [workspace2] ...");
    process.exit(1);
  }
  info(`Linting dependencies in workspaces: ${JSON.stringify(roots, undefined, 2)}`);
  const packages = await getAllWorkspacePackages(roots);
  let hadError = false;
  for (const pkg of packages) {
    const results = await run(pkg.path);
    if (!printAndAnalyzeResults(results, pkg.name)) {
      hadError = true;
    }
  }
  if (hadError) {
    info(
      "NOTE: Dependencies can be marked explicitly used with a comment, e.g.:\n  // foxglove-depcheck-used: foo-package",
    );
    process.exit(1);
  } else {
    info("No errors!");
  }
}

main().catch(console.error);
