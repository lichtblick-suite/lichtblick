// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// What the scenarios exercise, for the HTML viewer: scenario chips (overview, filter), the per-run
// "Exercises" card and the "Coverage" matrix (scenario × panel types / players / pipeline
// components). Pure; every text is escaped here.

import {
  COVERAGE_KINDS,
  COVERAGE_SYMBOLS,
  FILTER_GROUP_PREFIX,
  FILTER_TAG_PREFIX,
  SCENARIO_NOT_RECORDED,
} from "./constants";
import type {
  CoverageKind,
  CoverageStatus,
  ExercisedRun,
  ScenarioCoverage,
} from "./htmlReportExercises.types";
import { cell, escapeHtml, fmtNumber, renderTable } from "./htmlReportFormat";
import type { ExercisedComponents, ExercisedPanelType } from "../result/exercised.types";
import type { PersistedResultV1, ScenarioDescriptorV1 } from "../result/schemaV1";
import { compareCodeUnits } from "../shared/compare";

/** Filter tokens of a run (`group:<group>`, `tag:<tag>`); none without `run.scenario`. */
export function filterTokens(result: PersistedResultV1): string[] {
  const scenario = result.run.scenario;
  if (scenario == undefined) {
    return [];
  }
  return [
    `${FILTER_GROUP_PREFIX}${scenario.group}`,
    ...scenario.tags.map((tag) => `${FILTER_TAG_PREFIX}${tag}`),
  ];
}

/** Declared panel types with counts (sorted by type). */
function declaredPanelTypes(scenario: ScenarioDescriptorV1): ExercisedPanelType[] {
  const counts = new Map<string, number>();
  for (const panel of scenario.panels) {
    counts.set(panel.type, (counts.get(panel.type) ?? 0) + 1);
  }
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => compareCodeUnits(a.type, b.type));
}

function filterChip(token: string, label: string, extraClass = ""): string {
  const classes = ["chip", extraClass].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" data-filter="${escapeHtml(token)}" title="Show only ${escapeHtml(label)}">${escapeHtml(label)}</button>`;
}

function staticChip(label: string, title?: string): string {
  const titleAttr = title == undefined ? "" : ` title="${escapeHtml(title)}"`;
  return `<span class="chip chip-static"${titleAttr}>${escapeHtml(label)}</span>`;
}

function panelTypeChips(types: readonly ExercisedPanelType[]): string[] {
  return types.map(({ type, count }) => staticChip(`${type} ×${count}`, "panels in the layout"));
}

/**
 * Compact chips of a run's scenario: group and tags (clickable filters), declared panel types with
 * counts (observed ones for results without `run.scenario`) and the player.
 */
export function scenarioChipsHtml(
  result: PersistedResultV1,
  exercised: ExercisedComponents,
): string {
  const scenario = result.run.scenario;
  if (scenario == undefined) {
    const chips = [staticChip(SCENARIO_NOT_RECORDED), ...panelTypeChips(exercised.panelTypes)];
    return `<div class="chips">${chips.join("")}</div>`;
  }
  const chips = [
    filterChip(`${FILTER_GROUP_PREFIX}${scenario.group}`, scenario.group, "chip-group"),
    ...scenario.tags.map((tag) => filterChip(`${FILTER_TAG_PREFIX}${tag}`, tag)),
    ...panelTypeChips(declaredPanelTypes(scenario)),
    staticChip(scenario.player, "player"),
  ];
  return `<div class="chips">${chips.join("")}</div>`;
}

/** Filter bar of every group/tag of the shown runs, plus "all". */
export function filterBarHtml(results: readonly PersistedResultV1[]): string {
  const tokens = [...new Set(results.flatMap(filterTokens))].sort(compareCodeUnits);
  if (tokens.length === 0) {
    return "";
  }
  const chips = tokens.map((token) => {
    const isGroup = token.startsWith(FILTER_GROUP_PREFIX);
    const label = token.slice(isGroup ? FILTER_GROUP_PREFIX.length : FILTER_TAG_PREFIX.length);
    return filterChip(token, label, isGroup ? "chip-group" : "");
  });
  return `<div class="filter-bar chips" role="toolbar" aria-label="Filter runs by group or tag"><span class="muted">Filter:</span><button type="button" class="chip chip-active" data-filter="">all</button>${chips.join("")}<span class="muted filter-status" aria-live="polite"></span></div>`;
}

// ---------------------------------------------------------------------------------------------
// Exercises card
// ---------------------------------------------------------------------------------------------

function componentsHtml(exercised: ExercisedComponents): string {
  const components = exercised.pipelineComponents;
  const list =
    components.length === 0
      ? `<span class="muted">none (no pipeline telemetry)</span>`
      : components.map((component) => staticChip(component)).join("");
  return `<h4>Observed pipeline components</h4><div class="chips">${list}</div>`;
}

function paramsTable(scenario: ScenarioDescriptorV1): string {
  const params = Object.entries(scenario.params).sort(([a], [b]) => compareCodeUnits(a, b));
  if (params.length === 0) {
    return `<h4>Params</h4><p class="muted">No params (registry defaults).</p>`;
  }
  const rows = params.map(([key, value]) => [cell(key), cell(value)]);
  return `<h4>Params</h4>${renderTable(["Param", "Value"], rows)}`;
}

/** Declared panels and whether each produced telemetry; then observed-only panels. */
function declaredPanelsTable(
  scenario: ScenarioDescriptorV1,
  result: PersistedResultV1,
  exercised: ExercisedComponents,
): string {
  const silent = new Set(exercised.panelsDeclaredWithoutTelemetry);
  const declared = new Set(scenario.panels.map((panel) => panel.id));
  const rows = scenario.panels.map((panel) => [
    cell(panel.id),
    cell(panel.type),
    cell(panel.title ?? "—"),
    silent.has(panel.id)
      ? cell("⚠ no telemetry", {
          tone: "warn",
          title: "declared but no panel telemetry",
        })
      : cell("✓ observed"),
  ]);
  const extra = Object.entries(result.summary.panels ?? {})
    .filter(([id]) => !declared.has(id))
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([id, panel]) => [cell(id), cell(panel.panelType), cell("—"), cell("observed only")]);
  return `<h4>Panels (declared vs observed)</h4>${renderTable(["Panel", "Type", "Title", "Telemetry"], [...rows, ...extra])}`;
}

function observedPanelsHtml(exercised: ExercisedComponents): string {
  const types = exercised.panelTypes;
  const list =
    types.length === 0
      ? `<span class="muted">none (no panel telemetry)</span>`
      : panelTypeChips(types).join("");
  return `<h4>Observed panel types</h4><div class="chips">${list}</div>`;
}

/**
 * "Exercises" card at the top of a run section: what the scenario declares (description, layout,
 * data source, player, params, panels) next to what its telemetry shows. Results without
 * `run.scenario` show the observed side only.
 */
export function exercisesCardHtml(
  result: PersistedResultV1,
  exercised: ExercisedComponents,
): string {
  const scenario = result.run.scenario;
  if (scenario == undefined) {
    return `<div class="card exercises"><h3>Exercises</h3><p class="muted">${escapeHtml(SCENARIO_NOT_RECORDED)} (older result): observed telemetry only.</p>${observedPanelsHtml(exercised)}${componentsHtml(exercised)}</div>`;
  }
  const dataSource =
    scenario.dataSource.displayName == undefined
      ? scenario.dataSource.factoryId
      : `${scenario.dataSource.displayName} (${scenario.dataSource.factoryId})`;
  const entries: Array<[string, string]> = [
    ["layout", scenario.layout],
    ["data source", dataSource],
    ["player", scenario.player],
    [
      "duration (s)",
      scenario.durationMs == undefined ? "default" : fmtNumber(scenario.durationMs / 1000, 1),
    ],
  ];
  const details = renderTable(
    ["Field", "Value"],
    entries.map(([key, value]) => [cell(key), cell(value)]),
  );
  return `<div class="card exercises"><h3>Exercises</h3><p>${escapeHtml(scenario.description)}</p>${scenarioChipsHtml(result, exercised)}<div class="tables"><div>${details}${paramsTable(scenario)}</div><div>${declaredPanelsTable(scenario, result, exercised)}</div></div>${componentsHtml(exercised)}</div>`;
}

// ---------------------------------------------------------------------------------------------
// Coverage matrix
// ---------------------------------------------------------------------------------------------

function coverageKey(kind: CoverageKind, name: string): string {
  return `${kind}:${name}`;
}

function mark(cells: Map<string, CoverageStatus>, key: string, status: CoverageStatus): void {
  if (cells.get(key) !== "observed") {
    cells.set(key, status);
  }
}

/** Marks what one run declared (○) and observed (✓). */
function markRun(cells: Map<string, CoverageStatus>, run: ExercisedRun): void {
  const scenario = run.result.run.scenario;
  for (const panel of scenario?.panels ?? []) {
    mark(cells, coverageKey("panel", panel.type), "declared");
  }
  for (const { type } of run.exercised.panelTypes) {
    mark(cells, coverageKey("panel", type), "observed");
  }
  if (scenario != undefined) {
    const received = run.result.summary.pipeline?.messagesReceived ?? 0;
    mark(cells, coverageKey("player", scenario.player), received > 0 ? "observed" : "declared");
  }
  for (const component of run.exercised.pipelineComponents) {
    mark(cells, coverageKey("component", component), "observed");
  }
}

/** Coverage per scenario (all of its shown runs, any platform), sorted by scenario id. */
export function scenarioCoverage(runs: readonly ExercisedRun[]): ScenarioCoverage[] {
  const byScenario = new Map<string, ScenarioCoverage>();
  for (const run of runs) {
    const { scenarioId } = run.result.run;
    const entry = byScenario.get(scenarioId) ?? {
      scenarioId,
      filterTokens: [],
      cells: new Map<string, CoverageStatus>(),
    };
    entry.filterTokens = [...new Set([...entry.filterTokens, ...filterTokens(run.result)])];
    markRun(entry.cells, run);
    byScenario.set(scenarioId, entry);
  }
  return [...byScenario.values()].sort((a, b) => compareCodeUnits(a.scenarioId, b.scenarioId));
}

/** Column names per kind (sorted) over every scenario. */
function coverageColumns(rows: readonly ScenarioCoverage[]): Map<CoverageKind, string[]> {
  const columns = new Map<CoverageKind, Set<string>>();
  for (const row of rows) {
    for (const key of row.cells.keys()) {
      const separator = key.indexOf(":");
      const kind = key.slice(0, separator) as CoverageKind;
      const names = columns.get(kind) ?? new Set<string>();
      names.add(key.slice(separator + 1));
      columns.set(kind, names);
    }
  }
  return new Map(
    [...columns].map(([kind, names]) => [kind, [...names].sort(compareCodeUnits)] as const),
  );
}

function coverageCell(status: CoverageStatus | undefined): string {
  if (status == undefined) {
    return `<td class="cov"></td>`;
  }
  const { symbol, title } = COVERAGE_SYMBOLS[status];
  return `<td class="cov cov-${status}" title="${escapeHtml(title)}">${symbol}</td>`;
}

/**
 * "Coverage" section: scenario × (panel types ∪ players ∪ pipeline components). ✓ observed in
 * telemetry, ○ declared by the scenario only. A player counts as observed when the pipeline
 * received messages.
 */
export function coverageHtml(runs: readonly ExercisedRun[]): string {
  const rows = scenarioCoverage(runs);
  if (rows.length === 0) {
    return `<p class="muted">No runs.</p>`;
  }
  const columns = coverageColumns(rows);
  const kinds = COVERAGE_KINDS.filter(({ kind }) => (columns.get(kind) ?? []).length > 0);
  const groupHead = kinds
    .map(
      ({ kind, label }) => `<th colspan="${columns.get(kind)!.length}">${escapeHtml(label)}</th>`,
    )
    .join("");
  const nameHead = kinds
    .flatMap(({ kind }) =>
      columns.get(kind)!.map((name) => `<th class="cov-name">${escapeHtml(name)}</th>`),
    )
    .join("");
  const body = rows
    .map((row) => {
      const cells = kinds
        .flatMap(({ kind }) =>
          columns.get(kind)!.map((name) => coverageCell(row.cells.get(coverageKey(kind, name)))),
        )
        .join("");
      return `<tr data-tags="${escapeHtml(row.filterTokens.join(" "))}"><td>${escapeHtml(row.scenarioId)}</td>${cells}</tr>`;
    })
    .join("\n");
  const legend = Object.values(COVERAGE_SYMBOLS)
    .map(({ symbol, title }) => `${symbol} ${escapeHtml(title)}`)
    .join(" · ");
  return `<p class="muted">${legend} · blank: not exercised. Merged over the shown runs of each scenario (all platforms).</p>
<div class="table-wrap"><table class="coverage"><thead><tr><th rowspan="2">Scenario</th>${groupHead}</tr><tr>${nameHead}</tr></thead><tbody>
${body}
</tbody></table></div>`;
}
