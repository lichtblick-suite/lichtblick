// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Scenario } from "./types";

/** Small public NuScenes MCAP fixture, also used by the web E2E suite (`e2e/fixtures/urls.ts`). */
const MCAP_INGEST_FIXTURE_URL =
  "https://mcap-proxy.lichtblick.workers.dev/NuScenes-v1.0-mini-scene-sample.mcap";

/**
 * Scenarios mirror the existing `benchmarks.txt` entries (`?ds=<factoryId>`) so the same synthetic
 * sources can be driven either by manual layout selection (old way) or by `?scenario=<id>` (new,
 * fully automated way). Adding a scenario here never changes existing `?ds=` behavior.
 */
const SCENARIOS: readonly Scenario[] = [
  {
    id: "sinewave",
    layout: "sinewave",
    dataSource: { factoryId: "sinewave" },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "pointcloud",
    layout: "pointCloudMultipleThreeDee",
    dataSource: { factoryId: "pointcloud" },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "transform",
    layout: "multipleThreeDee",
    dataSource: { factoryId: "transform" },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "transformpreloading",
    layout: "transformPreloading",
    dataSource: { factoryId: "transformpreloading" },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "mcap-ingest",
    // "empty" until a fixture-specific layout is added: the other registered layouts assume
    // synthetic-player topic names that won't match this real MCAP file's topics.
    layout: "empty",
    dataSource: { factoryId: "mcap-real-pipeline", params: { url: MCAP_INGEST_FIXTURE_URL } },
    pipeline: "real",
    autoStart: true,
    durationMs: 5_000,
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}

/**
 * Looks up the scenario named by a `?scenario=<id>` query param on the given URL, if present.
 */
export function getScenarioFromUrl(url: URL): Scenario | undefined {
  const scenarioId = url.searchParams.get("scenario");
  return scenarioId != undefined ? getScenario(scenarioId) : undefined;
}

export { SCENARIOS };
