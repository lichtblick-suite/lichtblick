// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { SteadyWindowRecording } from "./steadyWindow.types";
import type { SteadyMeasurement } from "./types";
import type { HostProcessSample, TelemetryRecord } from "../result/schemaV1";
import type { CollectorsStateV1, EmitCostNsV1 } from "../result/telemetrySelf.types";

/** Page state read after an overhead A/B run (`readOverheadPageState`). */
export type OverheadPageState = {
  collectors?: CollectorsStateV1;
  /** Telemetry on only. */
  emitCostNs?: EmitCostNsV1;
};

/** Inputs of `withOverheadFields`. */
export type OverheadResultFields = {
  recording: SteadyWindowRecording;
  measurement: SteadyMeasurement;
  pageState: OverheadPageState;
  /** All host samples of the run (the steady polls are picked by `recording.pollTimestamps`). */
  hostSamples: readonly HostProcessSample[];
  /** All records drained from the page. */
  pageRecords: readonly TelemetryRecord[];
};
