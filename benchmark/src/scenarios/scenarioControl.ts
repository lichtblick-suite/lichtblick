// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Shared between the benchmark page (which installs the API, see `useScenarioBootstrap`) and the
// Playwright runner (`benchmark/e2e`, which calls it through `page.evaluate`). Keep it free of
// runtime imports.

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
}

/** Shape of a `window` carrying the API; use with `page.evaluate` in the runner. */
export type LichtblickScenarioControlWindow = {
  lichtblickScenario?: LichtblickScenarioControlApi;
};
