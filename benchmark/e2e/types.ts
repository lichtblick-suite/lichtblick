// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { BenchmarkMemoryMetric } from "../desktop/common/types";

export type ScenarioUnderTest = {
  scenarioId: string;
  /** Synthetic scenarios run on `BenchmarkPlayerBase` subclasses, which never implement
   * `startPlayback`/`pausePlayback` and so never expose a Play/Pause control to assert on: the
   * test just samples for a fixed `SAMPLE_DURATION_MS` window instead. */
  pipeline: "synthetic" | "real";
  /** Must match the scenario's own `durationMs` (registry.ts): the test waits for auto-pause. Only
   * meaningful for `pipeline: "real"`; if unset, the test samples for `SAMPLE_DURATION_MS` and
   * pauses manually via the Play/Pause toggle button. */
  durationMs?: number;
};

export type FrameTimeSample = { stamp: number; value: number };
export type MemorySample = { timestampMs: number; metrics: BenchmarkMemoryMetric[] };

/**
 * Raw per-run artifact written to `benchmark/.artifacts/<scenario-id>-<timestamp>.json`. Kept flat
 * and stable: a follow-up report generator (not part of this suite) parses this shape to produce
 * human-readable summaries/trends across runs.
 */
export type BenchmarkArtifact = {
  scenarioId: string;
  pipeline: string;
  startedAt: string;
  finishedAt: string;
  memorySamples: MemorySample[];
  frameTimeSamples: FrameTimeSample[];
};
