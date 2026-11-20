// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type {
  TelemetryEvent,
  TelemetryLabels,
  TelemetrySample,
} from "../../../../packages/suite-base/src/util/telemetry/types";

/** Labels of a layout panel (`panelId` is the layout id, e.g. `Plot!a`). */
export function panelLabels(panelId: string): TelemetryLabels {
  return { panelId, panelType: panelId.split("!")[0]! };
}

/**
 * Deterministic telemetry records for the v1 summary builder tests (fixed defaults so expected
 * totals, rates and percentiles can be asserted exactly).
 */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TelemetryRecordBuilder {
  public static sample(
    props: Partial<TelemetrySample> & Pick<TelemetrySample, "metric" | "value">,
  ): TelemetrySample {
    return {
      kind: "sample",
      realm: "renderer",
      sequence: 0,
      monotonicTs: 0,
      unit: "count",
      scope: "pipeline",
      metricType: "gauge",
      ...props,
    };
  }

  /**
   * Publishes of one counter series: `cumulative` published at `monotonicTs`, each with the delta
   * since the previous publish (like `BufferedTelemetrySink.publishNow`).
   */
  public static counterSeries(
    metric: string,
    points: ReadonlyArray<readonly [monotonicTs: number, cumulative: number]>,
    props: Partial<TelemetrySample> = {},
  ): TelemetrySample[] {
    let previous = 0;
    return points.map(([monotonicTs, cumulative]) => {
      const delta = cumulative - previous;
      previous = cumulative;
      return TelemetryRecordBuilder.sample({
        metric,
        value: cumulative,
        delta,
        monotonicTs,
        metricType: "counter",
        ...props,
      });
    });
  }

  /** Publishes of one gauge series: `value` published at `monotonicTs`. */
  public static gaugeSeries(
    metric: string,
    points: ReadonlyArray<readonly [monotonicTs: number, value: number]>,
    props: Partial<TelemetrySample> = {},
  ): TelemetrySample[] {
    return points.map(([monotonicTs, value]) =>
      TelemetryRecordBuilder.sample({ metric, value, monotonicTs, ...props }),
    );
  }

  /**
   * Publishes of one `observe()` series (like `BufferedTelemetrySink.publishNow`): per non-empty
   * window, `${metric}.count` and `${metric}.sum` counters (cumulative + delta) and the window's
   * `${metric}.max` gauge. `windows` hold the per-window `[monotonicTs, count, sum, max]`.
   */
  public static observationSeries(
    metric: string,
    windows: ReadonlyArray<readonly [monotonicTs: number, count: number, sum: number, max: number]>,
    props: Partial<TelemetrySample> = {},
  ): TelemetrySample[] {
    let totalCount = 0;
    let totalSum = 0;
    const counts: Array<[number, number]> = [];
    const sums: Array<[number, number]> = [];
    for (const [monotonicTs, count, sum] of windows) {
      totalCount += count;
      totalSum += sum;
      counts.push([monotonicTs, totalCount]);
      sums.push([monotonicTs, totalSum]);
    }
    return [
      ...TelemetryRecordBuilder.counterSeries(`${metric}.count`, counts, {
        ...props,
        unit: "count",
      }),
      ...TelemetryRecordBuilder.counterSeries(`${metric}.sum`, sums, { unit: "ms", ...props }),
      ...TelemetryRecordBuilder.gaugeSeries(
        `${metric}.max`,
        windows.map(([monotonicTs, , , max]) => [monotonicTs, max] as const),
        { unit: "ms", ...props },
      ),
    ].sort((a, b) => a.monotonicTs - b.monotonicTs);
  }

  public static event(
    props: Partial<TelemetryEvent> & Pick<TelemetryEvent, "name">,
  ): TelemetryEvent {
    return {
      kind: "event",
      realm: "renderer",
      sequence: 0,
      monotonicTs: 0,
      phase: "instant",
      scope: "app",
      ...props,
    };
  }

  /** `panel.mount` / `panel.unmount` / `panel.firstRender` of `panelId` at `monotonicTs`. */
  public static panelEvent(
    name: "panel.mount" | "panel.unmount" | "panel.firstRender",
    panelId: string,
    monotonicTs: number,
  ): TelemetryEvent {
    return TelemetryRecordBuilder.event({
      name,
      monotonicTs,
      scope: "panel",
      labels: panelLabels(panelId),
    });
  }
}
