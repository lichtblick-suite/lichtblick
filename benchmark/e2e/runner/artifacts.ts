// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import { ARTIFACTS_DIR } from "./constants";
import type { ScenarioRunResult } from "./types";
import { RESULT_V1_SUFFIX } from "../result/constants";
import type { BenchmarkPlatform, PersistedResultV1 } from "../result/schemaV1";

/**
 * Legacy artifact file name: unchanged `<scenarioId>-<ts>.json` for Electron (existing consumers),
 * `<scenarioId>-web-<ts>.json` for web.
 */
export function legacyArtifactFileName(
  scenarioId: string,
  platform: BenchmarkPlatform,
  timestamp: number,
): string {
  return platform === "electron"
    ? `${scenarioId}-${timestamp}.json`
    : `${scenarioId}-${platform}-${timestamp}.json`;
}

/**
 * `<scenarioId>-<platform>[-telemetry-off][-<variant>]-<ts>.benchmark-result.v1.json` (`variant`:
 * e.g. the overhead `on-noUa` arm, see `OVERHEAD_ARM_FILE_VARIANTS`).
 */
export function resultV1FileName({
  scenarioId,
  platform,
  telemetryEnabled,
  timestamp,
  variant,
}: {
  scenarioId: string;
  platform: BenchmarkPlatform;
  telemetryEnabled: boolean;
  timestamp: number;
  variant?: string;
}): string {
  const off = telemetryEnabled ? "" : "-telemetry-off";
  const suffix = variant == undefined ? "" : `-${variant}`;
  return `${scenarioId}-${platform}${off}${suffix}-${timestamp}${RESULT_V1_SUFFIX}`;
}

/**
 * Writes only the v1 result (e.g. overhead A/B runs); returns its path. Named with the run's
 * `runTimestamp`, like its screenshots.
 */
export function writeResultV1(
  {
    result,
    runTimestamp,
    variant,
  }: Pick<ScenarioRunResult, "runTimestamp"> & {
    /** Complete, or the partial result of a failed run (may lack `run.scenario`). */
    result: PersistedResultV1;
    /** File name variant (`resultV1FileName`). */
    variant?: string;
  },
  dir: string = ARTIFACTS_DIR,
): string {
  const { scenarioId, platform, telemetryEnabled } = result.run;
  fs.mkdirSync(dir, { recursive: true });
  const resultPath = path.join(
    dir,
    resultV1FileName({
      scenarioId,
      platform,
      telemetryEnabled,
      timestamp: runTimestamp,
      ...(variant != undefined && { variant }),
    }),
  );
  fs.writeFileSync(resultPath, JSON.stringify(result));
  return resultPath;
}

/**
 * Writes the legacy artifact and the v1 result; returns their paths. Both are named with the run's
 * `runTimestamp`, the same `<ts>` as the run's screenshots.
 */
export function writeScenarioArtifacts(
  run: ScenarioRunResult,
  dir: string = ARTIFACTS_DIR,
): { legacyPath: string; resultPath: string } {
  const { scenarioId, platform, telemetryEnabled } = run.result.run;
  const timestamp = run.runTimestamp;
  fs.mkdirSync(dir, { recursive: true });
  const legacyPath = path.join(dir, legacyArtifactFileName(scenarioId, platform, timestamp));
  const resultPath = path.join(
    dir,
    resultV1FileName({ scenarioId, platform, telemetryEnabled, timestamp }),
  );
  fs.writeFileSync(legacyPath, JSON.stringify(run.legacy, undefined, 2));
  fs.writeFileSync(resultPath, JSON.stringify(run.result));
  return { legacyPath, resultPath };
}
