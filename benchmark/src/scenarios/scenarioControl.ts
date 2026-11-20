// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Shared between the benchmark page (which installs the API, see `useScenarioBootstrap`) and the
// Playwright runner (`benchmark/e2e`, which calls it through `page.evaluate` and stores the
// descriptor in the result as `run.scenario`). Keep it free of runtime imports.

import type { SCENARIO_GROUPS, SCENARIO_TAGS } from "./constants";

/** What a scenario mainly stresses (see `SCENARIO_GROUPS`). */
export type ScenarioGroup = (typeof SCENARIO_GROUPS)[number];

/** Tag of the registry vocabulary (see `SCENARIO_TAGS`). */
export type ScenarioTag = (typeof SCENARIO_TAGS)[number];

/** One panel of the scenario's layout (a `configById` entry). */
export type ScenarioPanelDescriptor = {
  /** Layout panel id, e.g. `Plot!a` (same key as `summary.panels`). */
  readonly id: string;
  /** Panel type: the part of `id` before `!`. */
  readonly type: string;
  /** Panel title from its config (`title` / `foxglovePanelTitle`), when set. */
  readonly title?: string;
};

/**
 * Self-description of the active scenario as run by the page: registry metadata plus the effective
 * (URL-overridden, redacted) data source params and the panels of its layout. Plain JSON.
 */
export type ScenarioDescriptor = {
  readonly scenarioId: string;
  /** Short human sentence. */
  readonly description: string;
  readonly group: ScenarioGroup;
  /** Tags of the registry vocabulary (`SCENARIO_TAGS`); stored as plain strings. */
  readonly tags: readonly string[];
  /** Key of the layout in `LAYOUTS`. */
  readonly layout: string;
  readonly dataSource: { readonly factoryId: string; readonly displayName?: string };
  /** Player (and source) driving the scenario, e.g. "SinewavePlayer". */
  readonly player: string;
  /**
   * Effective data source params (registry defaults merged with `?ds.<param>=` overrides). Values
   * that may carry URLs or secrets are replaced by `"<redacted>"`.
   */
  readonly params: Readonly<Record<string, string>>;
  /** Scenario playback duration (auto-pause), when defined: `?scenario.durationMs=` or registry. */
  readonly durationMs?: number;
  /** Panels declared by the layout, in layout order. */
  readonly panels: readonly ScenarioPanelDescriptor[];
};

/**
 * Scenario control API the benchmark page exposes as `window.lichtblickScenario` while a
 * `?scenario=<id>` is active.
 */
export interface LichtblickScenarioControlApi {
  /**
   * Closes the current data source (player) without leaving the page, so its `datasource.close`
   * phase events and final pipeline counters are recorded and can still be drained.
   */
  closeDataSource(): void;
  /** Describes the active scenario (see `ScenarioDescriptor`). Pure; no side effects. */
  describe(): ScenarioDescriptor;
}

/** Shape of a `window` carrying the API; use with `page.evaluate` in the runner. */
export type LichtblickScenarioControlWindow = {
  lichtblickScenario?: LichtblickScenarioControlApi;
};
