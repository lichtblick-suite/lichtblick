// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { MainThreadRatesV1, SteadyWindowSummaryV1 } from "../../result/steadyWindow.types";
import type { CollectorsStateV1, TelemetrySelfSummaryV1 } from "../../result/telemetrySelf.types";
import type { OverheadArm, OverheadConfigV2, OverheadRunInput } from "../overhead.types";
import { armOrder } from "../overheadSchedule";

const MIB = 1024 * 1024;

export type OverheadRunProps = {
  arm: OverheadArm;
  repeat?: number;
  order?: number;
  sequence?: number;
  /** Steady median (= mean) total CPU, percent. Default 100. */
  cpu?: number;
  /** Steady mean (= peak) total working set, bytes; all in a `browser` process. Default 500 MiB. */
  wsBytes?: number;
  /** Per-type mean working set (overrides the `browser`-only split of `wsBytes`). */
  byType?: Record<string, number>;
  processSet?: Record<string, number>;
  windowMismatch?: boolean;
  /** Steady polls that overran their slot (default 0). */
  overruns?: number;
  /** Longest host poll, ms (absent by default, as in older results). */
  maxPollLatencyMs?: number;
  mainThread?: MainThreadRatesV1;
  telemetrySelf?: TelemetrySelfSummaryV1;
  collectors?: CollectorsStateV1;
};

export type OverheadArmProps = Omit<OverheadRunProps, "arm">;

/** Deterministic overhead A/B inputs for the report builder and report tests. */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class OverheadRunBuilder {
  public static config(overrides: Partial<OverheadConfigV2> = {}): OverheadConfigV2 {
    return {
      repeats: 5,
      warmupRuns: 1,
      arms: ["off", "on"],
      warmupMs: 3000,
      polls: 10,
      sampleIntervalMs: 1000,
      ...overrides,
    };
  }

  public static steady(props: OverheadArmProps): SteadyWindowSummaryV1 {
    const cpu = props.cpu ?? 100;
    const wsBytes = props.wsBytes ?? 500 * MIB;
    const windowMismatch = props.windowMismatch ?? false;
    return {
      warmupMs: 3000,
      requestedPolls: 10,
      polls: windowMismatch ? 8 : 10,
      overruns: props.overruns ?? 0,
      windowMismatch,
      startMonotonicTs: 1000,
      endMonotonicTs: 11_000,
      medianTotalCpuPercent: cpu,
      meanTotalCpuPercent: cpu,
      meanTotalWorkingSetBytes: wsBytes,
      peakTotalWorkingSetBytes: wsBytes,
      meanWorkingSetBytesByType: props.byType ?? { browser: wsBytes },
      processSet: props.processSet ?? { browser: 1 },
      ...(props.maxPollLatencyMs != undefined && { maxPollLatencyMs: props.maxPollLatencyMs }),
      ...(props.mainThread != undefined && { mainThread: props.mainThread }),
    };
  }

  /** One run as `buildOverheadReport` input (a minimal v1 result with the overhead fields). */
  public static input(props: OverheadRunProps): OverheadRunInput {
    const repeat = props.repeat ?? 0;
    const order = props.order ?? 0;
    return {
      arm: props.arm,
      repeat,
      order,
      sequence: props.sequence ?? repeat * 2 + order,
      resultFile: `run-${props.arm}-${repeat}.benchmark-result.v1.json`,
      result: {
        run: {
          telemetryEnabled: props.arm !== "off",
          environment: props.collectors == undefined ? {} : { collectors: props.collectors },
        },
        summary: {
          steadyWindow: OverheadRunBuilder.steady(props),
          ...(props.telemetrySelf != undefined && { telemetrySelf: props.telemetrySelf }),
        },
      },
    };
  }

  /**
   * Off/on runs of `repeats.length` repeats in ABBA order (even repeats off first); each entry's
   * `off` / `on` props apply to that repeat's runs.
   */
  public static abba(
    repeats: ReadonlyArray<{ off?: OverheadArmProps; on?: OverheadArmProps }>,
  ): OverheadRunInput[] {
    return repeats.flatMap((props, repeat) =>
      armOrder(["off", "on"], repeat).map((arm, order) =>
        OverheadRunBuilder.input({
          ...(arm === "off" ? props.off : props.on),
          arm,
          repeat,
          order,
        }),
      ),
    );
  }

  public static telemetrySelf(
    overrides: Partial<TelemetrySelfSummaryV1> = {},
  ): TelemetrySelfSummaryV1 {
    return {
      windowSec: 10,
      msPerSec: { total: 2, byComponent: { collectors: 1, frames: 1 } },
      recordsPerSec: 100,
      uaCalls: 0,
      emitCostNs: { gaugeNs: 200, counterNs: 150, eventNs: 600 },
      meanEmitNs: 200,
      estimatedEmitMsPerSec: 0.02,
      fractionOfCore: 0.00202,
      ...overrides,
    };
  }
}
