// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { ToggleBlockBuilder } from "./builders/ToggleBlockBuilder";
import {
  measurementAutoPauseMs,
  overheadWindowEndMonotonicTs,
  prepareOverheadPage,
  readOverheadState,
  withOverheadResult,
} from "./overheadMeasurement";
import type { SteadyWindowRecording } from "./steadyWindow.types";
import type { SteadyMeasurement, ToggleMeasurement } from "./types";
import { BenchmarkResultBuilder } from "../report/builders/BenchmarkResultBuilder";
import type { ScenarioUnderTest } from "../types";

const AUTO_PAUSING: ScenarioUnderTest = {
  scenarioId: "mcap-multi-ingest",
  pipeline: "real",
  durationMs: 10_000,
  usesMcapFixtures: true,
};
const SYNTHETIC: ScenarioUnderTest = { scenarioId: "sinewave", pipeline: "synthetic" };
const STEADY: SteadyMeasurement = { mode: "steady", warmupMs: 3000, polls: 10 };
const TOGGLE: ToggleMeasurement = {
  mode: "toggle",
  warmupMs: 5000,
  arms: ["off", "on", "on", "off"],
  blockMs: 3000,
  settleMs: 500,
  profileMs: 4000,
};
const STEADY_RECORDING: SteadyWindowRecording = {
  pollTimestamps: [2000, 3000],
  overruns: 0,
  maxPollLatencyMs: 40,
  clockSyncRttMs: 3,
  startMonotonicTs: 1000,
  endMonotonicTs: 3000,
  mainThreadStart: { longTaskMs: 0, frames: 0, nowMs: 1000 },
  mainThreadEnd: { longTaskMs: 20, frames: 120, nowMs: 3000 },
};

/** A page whose calls fail the test: overhead helpers that must not touch the page. */
function untouchablePage(): { page: Page; calls: jest.Mock } {
  const calls = jest.fn();
  const page = new Proxy({} as Page, {
    get: (_target, property) => {
      calls(property);
      return jest.fn();
    },
  });
  return { page, calls };
}

describe("measurementAutoPauseMs", () => {
  it("should cover the steady window plus the margin", () => {
    // Given / When
    const autoPauseMs = measurementAutoPauseMs(AUTO_PAUSING, STEADY);

    // Then: 3 s warm-up + 10 × 1 s polls + 2 s margin
    expect(autoPauseMs).toBe(15_000);
  });

  it("should cover the toggle blocks and the profile plus the margin", () => {
    // Given / When
    const autoPauseMs = measurementAutoPauseMs(AUTO_PAUSING, TOGGLE);

    // Then: 5 s warm-up + 4 × 3 s blocks + 4 s profile + 2 s margin
    expect(autoPauseMs).toBe(23_000);
  });

  it("should leave normal runs and scenarios without auto-pause alone", () => {
    // Given / When
    const normal = measurementAutoPauseMs(AUTO_PAUSING, undefined);
    const noAutoPause = measurementAutoPauseMs(SYNTHETIC, TOGGLE);

    // Then
    expect(normal).toBeUndefined();
    expect(noAutoPause).toBeUndefined();
  });
});

describe("overheadWindowEndMonotonicTs", () => {
  it("should end at the steady window or at the last toggle block", () => {
    // Given
    const blocks = [
      ToggleBlockBuilder.recording({ index: 0, arm: "off" }),
      ToggleBlockBuilder.recording({ index: 1, arm: "on" }),
    ];

    // When
    const steadyEnd = overheadWindowEndMonotonicTs({ steadyRecording: STEADY_RECORDING });
    const toggleEnd = overheadWindowEndMonotonicTs({
      toggleRecording: { blocks, warmupUaCalls: 0, clockSyncRttMs: 2 },
    });
    const none = overheadWindowEndMonotonicTs({});

    // Then
    expect(steadyEnd).toBe(3000);
    expect(toggleEnd).toBe(blocks[1]!.endMonotonicTs);
    expect(none).toBeUndefined();
  });
});

describe("toggle mode page helpers", () => {
  it("should neither install the probe nor read page state", async () => {
    // Given
    const { page, calls } = untouchablePage();

    // When
    await prepareOverheadPage(page, TOGGLE);
    const pageState = await readOverheadState(page, TOGGLE, { telemetryEnabled: true });

    // Then
    expect(calls).not.toHaveBeenCalled();
    expect(pageState).toEqual({});
  });
});

describe("withOverheadResult", () => {
  it("should add the steady window to a steady run's result", () => {
    // Given
    const result = BenchmarkResultBuilder.result({ telemetryEnabled: false });

    // When
    const withFields = withOverheadResult(result, {
      measurement: { ...STEADY, polls: 2 },
      recording: { steadyRecording: STEADY_RECORDING },
      pageState: {},
      hostSamples: [],
      pageRecords: [],
    });

    // Then
    expect(withFields.summary.steadyWindow).toMatchObject({ requestedPolls: 2 });
  });

  it("should return a toggle run's result unchanged", () => {
    // Given
    const result = BenchmarkResultBuilder.result({ telemetryEnabled: true });

    // When
    const unchanged = withOverheadResult(result, {
      measurement: TOGGLE,
      recording: { toggleRecording: { blocks: [], warmupUaCalls: 0, clockSyncRttMs: 2 } },
      pageState: {},
      hostSamples: [],
      pageRecords: [],
    });

    // Then
    expect(unchanged).toBe(result);
  });
});
