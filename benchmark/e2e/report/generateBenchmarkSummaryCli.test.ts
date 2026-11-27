// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import type { BenchmarkArtifact } from "../types";
import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";

// Tests the `ci-helpers/generate-benchmark-summary.ts` CLI. Kept outside `ci-helpers/` because the
// root tsconfig type-checks that folder without Jest types.

// Same directories as the CLI (`report/` and `ci-helpers/` are siblings).
const ARTIFACTS_DIR = path.join(__dirname, "..", "..", ".artifacts");
const REPORTS_DIR = path.join(__dirname, "..", "reports");

const RESULT_FILE = "sinewave-electron-1.benchmark-result.v1.json";

/**
 * Serves `files` as the only content of the artifacts directory (no Playwright reports) and returns
 * the `readFileSync` spy. Every other path goes to the real `fs`, which Jest itself keeps using.
 */
function fakeArtifactsDir(files: Record<string, string>): jest.SpyInstance {
  const realExistsSync = fs.existsSync;
  const realReaddirSync = fs.readdirSync;
  const realReadFileSync = fs.readFileSync;
  jest.spyOn(fs, "existsSync").mockImplementation((target) => {
    if (target === ARTIFACTS_DIR) {
      return true;
    }
    return target === REPORTS_DIR ? false : realExistsSync(target);
  });
  jest
    .spyOn(fs, "readdirSync")
    .mockImplementation(((target: fs.PathLike, ...rest: unknown[]) =>
      target === ARTIFACTS_DIR
        ? Object.keys(files)
        : (realReaddirSync as (...args: unknown[]) => unknown)(
            target,
            ...rest,
          )) as unknown as typeof fs.readdirSync);
  return jest.spyOn(fs, "readFileSync").mockImplementation(((
    target: fs.PathOrFileDescriptor,
    ...rest: unknown[]
  ) => {
    const name =
      typeof target === "string" && path.dirname(target) === ARTIFACTS_DIR
        ? path.basename(target)
        : undefined;
    if (name != undefined && name in files) {
      return files[name];
    }
    return (realReadFileSync as (...args: unknown[]) => unknown)(target, ...rest);
  }) as unknown as typeof fs.readFileSync);
}

/** Runs the CLI (its `main()` runs on import) and returns what it wrote to stdout. */
async function runSummary(): Promise<string> {
  const chunks: string[] = [];
  jest.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  });
  await jest.isolateModulesAsync(async () => {
    await import("../ci-helpers/generate-benchmark-summary");
  });
  return chunks.join("");
}

function legacyArtifact(): BenchmarkArtifact {
  return {
    scenarioId: "sinewave",
    pipeline: "synthetic",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:05.000Z",
    memorySamples: [
      {
        timestampMs: 0,
        metrics: [
          {
            pid: 1,
            type: "Browser",
            memory: { workingSetSize: 2048, peakWorkingSetSize: 2048 },
            cpu: { percentCPUUsage: 0 },
          },
        ],
      },
    ],
    frameTimeSamples: [
      { stamp: 1, value: 2 },
      { stamp: 2, value: 4 },
    ],
  };
}

describe("generate-benchmark-summary", () => {
  it("should read each v1 result once and use it in every section", async () => {
    // Given one v1 result in the artifacts directory
    const readFileSync = fakeArtifactsDir({
      [RESULT_FILE]: JSON.stringify(BenchmarkResultBuilder.result({ scenarioId: "sinewave" })),
    });

    // When
    const output = await runSummary();

    // Then the file was read and parsed once
    const reads = readFileSync.mock.calls.filter(
      ([target]) => target === path.join(ARTIFACTS_DIR, RESULT_FILE),
    );
    expect(reads).toHaveLength(1);
    // And every v1 section was built from it
    expect(output).toContain("## KPI Scorecard");
    expect(output).toContain("## Benchmark Telemetry Results (benchmark-result.v1)");
    expect(output).toContain("## Panels and Pipeline (benchmark-result.v1)");
    expect(output).not.toContain("No benchmark-result.v1");
  });

  it("should label the legacy table's dispatch columns as listener dispatch, not frame time", async () => {
    // Given a legacy artifact with two listener dispatch samples (2 ms and 4 ms)
    fakeArtifactsDir({ "sinewave-123.json": JSON.stringify(legacyArtifact()) });

    // When
    const output = await runSummary();

    // Then
    expect(output).toContain(
      "| Scenario | Pipeline | Avg Memory | Peak Memory | Avg Listener Dispatch | Dispatch Samples |",
    );
    expect(output).toContain("| sinewave | synthetic | 2.0 MB | 2.0 MB | 3.00ms | 2 |");
    expect(output).not.toContain("Frame Time");
  });
});
