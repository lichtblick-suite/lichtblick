// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { OverheadPageState } from "./overheadPage.types";
import type { SteadyWindowRecording } from "./steadyWindow.types";
import type { ToggleWindowRecording } from "./toggleBlocks.types";
import type { SteadyMeasurement, ToggleMeasurement } from "./types";
import type { HostProcessSample, TelemetryRecord } from "../result/schemaV1";

/** Overhead A/B measurement of a run (`RunScenarioOptions.measurement`). */
export type OverheadMeasurement = SteadyMeasurement | ToggleMeasurement;

/** Toggle blocks of a run with the round trip of their Node → page clock sync. */
export type TimedToggleRecording = ToggleWindowRecording & { clockSyncRttMs: number };

/** What `recordOverheadWindow` measured: the steady window or the toggle blocks. */
export type OverheadWindowRecording = {
  steadyRecording?: SteadyWindowRecording;
  toggleRecording?: TimedToggleRecording;
};

/** Inputs of `withOverheadResult`. */
export type OverheadRunData = {
  measurement: OverheadMeasurement;
  recording: OverheadWindowRecording;
  pageState: OverheadPageState;
  /** All host samples of the run (the steady polls are picked by the recording). */
  hostSamples: readonly HostProcessSample[];
  /** All records drained from the page. */
  pageRecords: readonly TelemetryRecord[];
};
