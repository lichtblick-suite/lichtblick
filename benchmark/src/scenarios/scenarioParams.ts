// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { DS_PARAM_PREFIX } from "./constants";
import { ResolvedScenarioParams, Scenario } from "./types";

/**
 * Collects `?ds.<param>=<value>` overrides from a page URL, with the same semantics as the app's
 * own deep-link parsing (`parseAppURLState`): empty keys/values are ignored, a repeated `ds.url`
 * is joined with "," (so `ds.url=a&ds.url=b` equals `ds.url=a,b`), any other repeated key keeps
 * its last value.
 */
export function getDataSourceParamOverrides(url: URL): Record<string, string> {
  const overrides: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    if (!key.startsWith(DS_PARAM_PREFIX) || value.length === 0) {
      return;
    }
    const name = key.slice(DS_PARAM_PREFIX.length);
    if (name.length === 0) {
      return;
    }
    const previous = overrides[name];
    overrides[name] = name === "url" && previous != undefined ? `${previous},${value}` : value;
  });
  return overrides;
}

/**
 * Resolves the params used to select a scenario's data source: registry `dataSource.params`
 * merged with `?ds.<param>=` overrides from the page URL (overrides win), plus the list of
 * `requiredParams` still missing afterwards.
 */
export function resolveScenarioDataSourceParams(
  scenario: Scenario,
  url: URL,
): ResolvedScenarioParams {
  const overrides = getDataSourceParamOverrides(url);
  const hasOverrides = Object.keys(overrides).length > 0;
  const defaults = scenario.dataSource.params;
  const params = hasOverrides ? { ...defaults, ...overrides } : defaults;

  const missingParams: string[] = [];
  for (const name of scenario.dataSource.requiredParams ?? []) {
    const value = params?.[name];
    if (value == undefined || value.length === 0) {
      missingParams.push(name);
    }
  }
  return { params, missingParams };
}
