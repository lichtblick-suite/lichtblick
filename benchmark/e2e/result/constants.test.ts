// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  TELEMETRY_SELF_TIME_METRICS,
  TELEMETRY_SELF_UA_CALLS_METRIC,
  TELEMETRY_SELF_UA_FAILURES_METRIC,
  TELEMETRY_SELF_UA_RESOLVED_METRIC,
  TELEMETRY_SELF_UA_RESOLVE_MS_METRIC,
} from "./constants";
import { TELEMETRY_SELF_COST_METRICS } from "../../src/telemetry/constants";

describe("telemetry self-cost metric names", () => {
  it("should match the page's TELEMETRY_SELF_COST_METRICS", () => {
    // Given the runner's mirrored names
    const mirrored = {
      collectorsMs: TELEMETRY_SELF_TIME_METRICS.collectors,
      framesMs: TELEMETRY_SELF_TIME_METRICS.frames,
      longTasksMs: TELEMETRY_SELF_TIME_METRICS.longTasks,
      sinkPublishMs: TELEMETRY_SELF_TIME_METRICS.sinkPublish,
      drainMs: TELEMETRY_SELF_TIME_METRICS.drain,
      uaMemoryMs: TELEMETRY_SELF_TIME_METRICS.uaMemory,
      uaMemoryCalls: TELEMETRY_SELF_UA_CALLS_METRIC,
      uaMemoryResolveMs: TELEMETRY_SELF_UA_RESOLVE_MS_METRIC,
      uaMemoryResolved: TELEMETRY_SELF_UA_RESOLVED_METRIC,
      uaMemoryFailures: TELEMETRY_SELF_UA_FAILURES_METRIC,
    };

    // When / Then
    expect(mirrored).toEqual(TELEMETRY_SELF_COST_METRICS);
  });
});
