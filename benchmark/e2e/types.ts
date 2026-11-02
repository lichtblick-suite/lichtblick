// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type ScenarioUnderTest = {
  scenarioId: string;
  /** Synthetic scenarios run on `BenchmarkPlayerBase` subclasses, which never implement
   * `startPlayback`/`pausePlayback` and so never expose a Play/Pause control to assert on: the
   * runner just samples for a fixed `DEFAULT_SAMPLE_DURATION_MS` window instead. */
  pipeline: "synthetic" | "real";
  /** Must match the scenario's own `durationMs` (registry.ts): the runner samples for this long
   * (the page auto-pauses at the same deadline). If unset, the runner samples for
   * `DEFAULT_SAMPLE_DURATION_MS`. */
  durationMs?: number;
  /** The scenario reads the runtime-generated MCAP fixtures (`fixtures/generateMcapFixtures.ts`),
   * passed to the page as `?ds.url=<comma-separated fixture URLs>`. */
  usesMcapFixtures?: boolean;
};

/** Legacy frame-time sample as written to the artifact (`stamp` = wall-clock seconds). */
export type FrameTimeSample = { stamp: number; value: number };

/**
 * Process entry of a legacy `MemorySample`. Electron writes its `ProcessMetric`s
 * (`app.getAppMetrics()`) unmodified, which are structurally compatible; the web runner writes this
 * minimal subset built from CDP `SystemInfo.getProcessInfo` + `ps` RSS. Memory values are KB.
 */
export type LegacyProcessMetric = {
  pid: number;
  type: string;
  memory: { workingSetSize: number; peakWorkingSetSize: number; privateBytes?: number };
  cpu: { percentCPUUsage: number };
};

export type MemorySample = { timestampMs: number; metrics: LegacyProcessMetric[] };

/**
 * Raw per-run artifact written to `benchmark/.artifacts/<scenario-id>-<timestamp>.json` (Electron)
 * or `<scenario-id>-web-<timestamp>.json` (web). Kept flat
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
