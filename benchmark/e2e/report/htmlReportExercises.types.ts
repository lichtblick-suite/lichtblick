// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ExercisedComponents } from "../result/exercised.types";
import type { PersistedResultV1 } from "../result/schemaV1";

/** A shown run with what it exercised (`exercisedComponents`, computed once per run). */
export type ExercisedRun = {
  index: number;
  result: PersistedResultV1;
  exercised: ExercisedComponents;
};

/** ✓ seen in telemetry; ○ declared by `run.scenario` only. */
export type CoverageStatus = "observed" | "declared";

export type CoverageKind = "panel" | "player" | "component";

/** Coverage of one scenario (all its shown runs): `<kind>:<name>` -> status. */
export type ScenarioCoverage = {
  scenarioId: string;
  filterTokens: string[];
  cells: Map<string, CoverageStatus>;
};
