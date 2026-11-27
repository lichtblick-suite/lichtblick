// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure builder of `window.lichtblickScenario.describe()` (see `scenarioControl.ts`).

import { REDACTED_PARAM_VALUE, REDACTED_VALUE_PREFIXES, SECRET_PARAM_NAMES } from "./constants";
import type { ScenarioDescriptor, ScenarioPanelDescriptor } from "./scenarioControl";
import type { BuildScenarioDescriptorInput, LayoutPanelConfigs } from "./scenarioDescriptor.types";

/** Panel config fields holding a user-visible title, in order of preference. */
const PANEL_TITLE_FIELDS = ["title", "foxglovePanelTitle"] as const;

function shouldRedact(name: string, value: string): boolean {
  if (SECRET_PARAM_NAMES.has(name.toLowerCase())) {
    return true;
  }
  const lower = value.trim().toLowerCase();
  return REDACTED_VALUE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Copies `params`, replacing values that may carry URLs or secrets with `"<redacted>"`: params
 * named like `SECRET_PARAM_NAMES` (case-insensitive) and values starting with a
 * `REDACTED_VALUE_PREFIXES` scheme. The key is kept so readers still see the param was set.
 */
export function redactScenarioParams(
  params: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [name, value] of Object.entries(params ?? {})) {
    redacted[name] = shouldRedact(name, value) ? REDACTED_PARAM_VALUE : value;
  }
  return redacted;
}

function panelTitle(config: Readonly<Record<string, unknown>> | undefined): string | undefined {
  for (const field of PANEL_TITLE_FIELDS) {
    const value = config?.[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

/** Lists the panels of a layout's `configById` (layout order); type = the id part before `!`. */
export function describeLayoutPanels(
  configById: LayoutPanelConfigs | undefined,
): ScenarioPanelDescriptor[] {
  const panels: ScenarioPanelDescriptor[] = [];
  for (const [id, config] of Object.entries(configById ?? {})) {
    const separator = id.indexOf("!");
    const type = separator === -1 ? id : id.slice(0, separator);
    const title = panelTitle(config);
    panels.push(title == undefined ? { id, type } : { id, type, title });
  }
  return panels;
}

/**
 * Describes a scenario as the page runs it: registry metadata, the effective data source params
 * (`params`: registry defaults merged with `?ds.<param>=` overrides, see
 * `resolveScenarioDataSourceParams`), redacted, and the panels of its layout.
 */
export function buildScenarioDescriptor({
  scenario,
  params,
  layout,
  durationMs = scenario.durationMs,
}: BuildScenarioDescriptorInput): ScenarioDescriptor {
  const { factoryId, displayName } = scenario.dataSource;
  return {
    scenarioId: scenario.id,
    description: scenario.description,
    group: scenario.group,
    tags: [...scenario.tags],
    layout: scenario.layout,
    dataSource: displayName == undefined ? { factoryId } : { factoryId, displayName },
    player: scenario.player,
    params: redactScenarioParams(params),
    ...(durationMs != undefined && { durationMs }),
    panels: describeLayoutPanels(layout?.configById),
  };
}
