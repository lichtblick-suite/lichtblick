// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { StoredResultV1 } from "./schemaV1";

/** The parts of a (stored) v1 result `exercisedComponents` reads. */
export type ExercisedComponentsInput = Pick<StoredResultV1, "samples" | "summary"> & {
  run: Pick<StoredResultV1["run"], "scenario">;
};

export type ExercisedPanelType = { type: string; count: number };

/** What a run exercised, derived from its telemetry (see `exercisedComponents`). */
export type ExercisedComponents = {
  /** Product pipeline components that emitted telemetry (`EXERCISED_COMPONENT_PREFIXES`), sorted. */
  pipelineComponents: string[];
  /** Panel types with panel telemetry (`summary.panels`) and their panel count, sorted by type. */
  panelTypes: ExercisedPanelType[];
  /**
   * Layout panel ids declared by `run.scenario.panels` without any panel telemetry (absent from
   * `summary.panels`), sorted. Empty when the result has no `run.scenario`.
   */
  panelsDeclaredWithoutTelemetry: string[];
};
