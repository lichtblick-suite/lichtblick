// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// CLI of the interim HTML viewer: `yarn test:e2e:benchmark:viewer [--all] [--dir <path>] [--open]`.
// Reads `<dir>/*.benchmark-result.v1.json`, `<dir>/overhead-*.json` and `<dir>/screenshots/*.png`,
// writes `<dir>/report/index.html` and prints its absolute path.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { REPORT_DIR_NAME, SCREENSHOTS_DIR_NAME } from "./constants";
import { buildHtmlReport } from "./htmlReport";
import { CliArgs } from "./htmlReportCli.types";
import { parseOverheadFile, parseResultFile } from "./htmlReportData";
import { LoadedResult } from "./types";
import { OVERHEAD_PREFIX, RESULT_V1_SUFFIX } from "../result/constants";
import { ARTIFACTS_DIR as DEFAULT_ARTIFACTS_DIR } from "../runner/constants";
import type { OverheadReport } from "../runner/types";
import { GIT_EXECUTABLE_CANDIDATES } from "../shared/constants";
import { findExecutable, openFileCommand } from "../shared/executables";

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { all: false, dir: DEFAULT_ARTIFACTS_DIR, open: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      args.all = true;
    } else if (arg === "--open") {
      args.open = true;
    } else if (arg === "--dir") {
      const dir = argv[++i];
      if (dir == undefined) {
        throw new Error("--dir needs a path");
      }
      args.dir = path.resolve(dir);
    } else if (arg?.startsWith("--dir=") === true) {
      args.dir = path.resolve(arg.slice("--dir=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}. Usage: [--all] [--dir <path>] [--open]`);
    }
  }
  return args;
}

function listFiles(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort((a, b) => a.localeCompare(b)) : [];
}

/** Chart.js 4's `exports` map hides `dist/chart.umd.js`; resolve the package entry instead. */
function loadChartJs(): string {
  const entry = require.resolve("chart.js", { paths: [path.join(__dirname, "..", "..")] });
  return fs.readFileSync(path.join(path.dirname(entry), "chart.umd.js"), "utf-8");
}

function gitInfo(): { commit?: string; branch?: string } {
  const git = findExecutable(GIT_EXECUTABLE_CANDIDATES);
  const fromGit = (args: string[]): string | undefined => {
    if (git == undefined) {
      return undefined;
    }
    try {
      return execFileSync(git, args, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return undefined;
    }
  };
  // GITHUB_HEAD_REF is set but empty outside pull requests.
  const env = (name: string) => (process.env[name] === "" ? undefined : process.env[name]);
  return {
    commit: env("GITHUB_SHA") ?? fromGit(["rev-parse", "HEAD"]),
    branch:
      env("GITHUB_HEAD_REF") ??
      env("GITHUB_REF_NAME") ??
      fromGit(["rev-parse", "--abbrev-ref", "HEAD"]),
  };
}

function openInBrowser(file: string): void {
  const open = openFileCommand(file);
  if (open == undefined) {
    console.warn("Could not open the report: no known opener for this platform");
    return;
  }
  const { command, args } = open;
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", (error) => {
    console.warn(`Could not open the report (${command}): ${error.message}`);
  });
  child.unref();
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const files = listFiles(args.dir);

  const results: LoadedResult[] = [];
  const skipped: { fileName: string; reason: string }[] = [];
  for (const fileName of files.filter((file) => file.endsWith(RESULT_V1_SUFFIX))) {
    const outcome = parseResultFile(
      fileName,
      fs.readFileSync(path.join(args.dir, fileName), "utf-8"),
    );
    if (outcome.ok) {
      results.push(outcome.value);
    } else {
      console.warn(`Skipping ${fileName}: ${outcome.reason}`);
      skipped.push({ fileName, reason: outcome.reason });
    }
  }

  const overheads: OverheadReport[] = [];
  for (const fileName of files.filter(
    (file) => file.startsWith(OVERHEAD_PREFIX) && file.endsWith(".json"),
  )) {
    const outcome = parseOverheadFile(fs.readFileSync(path.join(args.dir, fileName), "utf-8"));
    if (outcome.ok) {
      overheads.push(outcome.value);
    } else {
      console.warn(`Skipping ${fileName}: ${outcome.reason}`);
    }
  }

  const html = buildHtmlReport(
    {
      generatedAtWall: new Date().toISOString(),
      git: gitInfo(),
      results,
      all: args.all,
      skipped,
      overheads,
      screenshotFiles: listFiles(path.join(args.dir, SCREENSHOTS_DIR_NAME)),
      // The report lives in `<dir>/report/`: screenshots resolve as long as both folders are kept
      // together (also in the CI artifact, rooted at `.artifacts/`).
      screenshotsHref: `../${SCREENSHOTS_DIR_NAME}/`,
    },
    { loadChartJs },
  );

  const outDir = path.join(args.dir, REPORT_DIR_NAME);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "index.html");
  fs.writeFileSync(outFile, html);
  process.stdout.write(`${outFile}\n`);
  if (args.open) {
    openInBrowser(outFile);
  }
}

main();
