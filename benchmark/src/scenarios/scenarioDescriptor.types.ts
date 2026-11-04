// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Scenario } from "./types";

/** A layout's `configById`: panel id (e.g. `Plot!a`) -> panel config. */
export type LayoutPanelConfigs = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export type BuildScenarioDescriptorInput = {
  scenario: Scenario;
  /** Effective data source params (registry defaults + `?ds.<param>=` overrides). */
  params: Readonly<Record<string, string>> | undefined;
  /** The scenario's layout (`LAYOUTS[scenario.layout]`); undefined lists no panels. */
  layout: { readonly configById: LayoutPanelConfigs } | undefined;
  /**
   * Effective auto-pause duration (`?scenario.durationMs=` override or registry value, see
   * `resolveScenarioDurationMs`); falls back to `scenario.durationMs` when absent.
   */
  durationMs?: number;
};
