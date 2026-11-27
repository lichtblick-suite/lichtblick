// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Scenario } from "./types";

/** `displayName` of `SyntheticDataSourceFactory`. */
const SYNTHETIC_DISPLAY_NAME = "Synthetic";
/** `displayName` of `McapRealPipelineBenchmarkDataSourceFactory`. */
const REAL_PIPELINE_DISPLAY_NAME = "MCAP (real pipeline)";

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
    description: "One Plot panel charting a synthetic sine wave signal.",
    group: "time-series",
    tags: ["plot", "synthetic"],
    player: "SinewavePlayer",
    layout: "sinewave",
    dataSource: { factoryId: "sinewave", displayName: SYNTHETIC_DISPLAY_NAME },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "pointcloud",
    description: "Six 3D panels rendering synthetic point clouds.",
    group: "3d-rendering",
    tags: ["3d", "pointcloud", "synthetic"],
    player: "PointcloudPlayer",
    layout: "pointCloudMultipleThreeDee",
    dataSource: { factoryId: "pointcloud", displayName: SYNTHETIC_DISPLAY_NAME },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "transform",
    description: "Six 3D panels following a synthetic transform (tf) stream.",
    group: "3d-rendering",
    tags: ["3d", "tf", "synthetic"],
    player: "TransformPlayer",
    layout: "multipleThreeDee",
    dataSource: { factoryId: "transform", displayName: SYNTHETIC_DISPLAY_NAME },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "transformpreloading",
    description: "Raw Messages and 3D panels over preloaded (block-loaded) synthetic transforms.",
    group: "preloading",
    tags: ["3d", "raw-messages", "tf", "preloading", "synthetic"],
    player: "TransformPreloadingPlayer",
    layout: "transformPreloading",
    dataSource: { factoryId: "transformpreloading", displayName: SYNTHETIC_DISPLAY_NAME },
    pipeline: "synthetic",
    autoStart: true,
  },
  {
    id: "mcap-ingest",
    description: "One remote MCAP file ingested through the real player pipeline, without panels.",
    group: "real-pipeline-ingest",
    tags: ["real-pipeline", "mcap"],
    player: "IterablePlayer + McapIterableSource (main thread)",
    // "empty" until a fixture-specific layout is added: the other registered layouts assume
    // synthetic-player topic names that won't match this real MCAP file's topics.
    layout: "empty",
    dataSource: {
      factoryId: "mcap-real-pipeline",
      displayName: REAL_PIPELINE_DISPLAY_NAME,
      params: { url: MCAP_INGEST_FIXTURE_URL },
      requiredParams: ["url"],
    },
    pipeline: "real",
    autoStart: true,
    durationMs: 5_000,
  },
  {
    // Multi-file ingest through the real worker pipeline (MultiIterableSource + HydratedSourcePool).
    // No URL is hardcoded: the runner serves generated, time-overlapping MCAP fixtures (topic
    // `/benchmark/multi`) on a dynamic port and passes them as
    // `?scenario=mcap-multi-ingest&ds.url=<url1>,<url2>,...`.
    id: "mcap-multi-ingest",
    description:
      "Several time-overlapping MCAP files ingested through the real worker pipeline with one " +
      "hydrated source at a time, shown in Raw Messages and Plot panels.",
    group: "real-pipeline-ingest",
    tags: ["real-pipeline", "mcap", "multi-source", "raw-messages", "plot"],
    player: "IterablePlayer + McapIterableSource (worker)",
    layout: "mcapMultiIngest",
    dataSource: {
      factoryId: "mcap-real-pipeline",
      displayName: REAL_PIPELINE_DISPLAY_NAME,
      // A single hydrated source forces eviction/re-hydration across the overlapping files.
      params: { maxHydratedSources: "1" },
      requiredParams: ["url"],
    },
    pipeline: "real",
    autoStart: true,
    durationMs: 10_000,
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
