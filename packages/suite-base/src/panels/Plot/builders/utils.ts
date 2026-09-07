// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Immutable, MessageEvent } from "@lichtblick/suite";

import { GetViewportDatasetsResult, SeriesConfigKey, SeriesItem } from "./IDatasetsBuilder";
import { CurrentFrameSeriesItem } from "./types";
import { Dataset } from "../types";

/**
 * Series item type shared by builders that work only with the current frame (no accumulation).
 * Used by IndexDatasetsBuilder and CurrentCustomDatasetsBuilder.
 */
const emptyPaths = new Set<string>();

/**
 * Caps how many current-frame (unpreloaded) datums a series accumulates so memory does not grow
 * indefinitely. Shared by builders that separately track current and full (preloaded) buffers.
 */
export const MAX_CURRENT_DATUMS_PER_SERIES = 50_000;

/**
 * Builds the chart.js dataset styling fields derived from a series config. Shared by builders
 * that render full/current data (CustomDatasetsBuilderImpl, TimestampDatasetsBuilderImpl) and
 * `setSeries` below for builders that only track the current frame.
 */
export function buildDatasetStyle(config: Immutable<SeriesItem>): Omit<Dataset, "data"> {
  const { color, contrastColor, showLine, lineSize } = config;
  return {
    borderColor: color,
    showLine,
    fill: false,
    borderWidth: lineSize,
    pointRadius: lineSize * 1.2,
    pointHoverRadius: 3,
    pointBackgroundColor: showLine ? contrastColor : color,
    pointBorderColor: "transparent",
  };
}

/**
 * Series entry shared by builders that accumulate both a "full" (preloaded) and "current"
 * (unpreloaded) buffer of items. Used by CustomDatasetsBuilderImpl and TimestampDatasetsBuilderImpl.
 */
type FullAndCurrentSeries<TItem> = {
  config: Immutable<SeriesItem>;
  current: TItem[];
  full: TItem[];
};

/**
 * Rebuilds a series map from a new config array, preserving each series' existing current/full
 * buffers for matching keys.
 */
export function updateSeriesConfig<TItem>(
  existing: ReadonlyMap<SeriesConfigKey, FullAndCurrentSeries<TItem>>,
  series: Immutable<SeriesItem[]>,
): Map<SeriesConfigKey, FullAndCurrentSeries<TItem>> {
  const newSeries = new Map<SeriesConfigKey, FullAndCurrentSeries<TItem>>();

  for (const config of series) {
    let existingSeries = existing.get(config.key);
    existingSeries ??= { config, current: [], full: [] };
    existingSeries.config = config;
    newSeries.set(config.key, existingSeries);
  }

  return newSeries;
}

/**
 * Rebuilds the series map from a new config array, preserving existing dataset data for
 * matching keys and updating chart.js styling properties.
 */
export function setSeries(
  existing: ReadonlyMap<SeriesConfigKey, CurrentFrameSeriesItem>,
  series: Immutable<SeriesItem[]>,
): Map<SeriesConfigKey, CurrentFrameSeriesItem> {
  const newSeries = new Map<SeriesConfigKey, CurrentFrameSeriesItem>();

  for (const item of series) {
    let existingSeries = existing.get(item.key);
    existingSeries ??= {
      configIndex: item.configIndex,
      enabled: item.enabled,
      messagePath: item.messagePath,
      parsed: item.parsed,
      dataset: { data: [] },
    };

    existingSeries.configIndex = item.configIndex;
    existingSeries.enabled = item.enabled;
    existingSeries.dataset = {
      ...existingSeries.dataset,
      ...buildDatasetStyle(item),
    };

    newSeries.set(item.key, existingSeries);
  }

  return newSeries;
}

/**
 * Builds a GetViewportDatasetsResult from a series map. No downsampling is performed —
 * suitable for builders that process only the current frame.
 */
export function buildViewportDatasets(
  seriesByKey: ReadonlyMap<SeriesConfigKey, CurrentFrameSeriesItem>,
  pathsWithMismatchedDataLengths: ReadonlySet<string> = emptyPaths,
): GetViewportDatasetsResult {
  const datasets: Dataset[] = [];
  for (const series of seriesByKey.values()) {
    if (series.enabled) {
      datasets[series.configIndex] = series.dataset;
    }
  }
  return { datasetsByConfigIndex: datasets, pathsWithMismatchedDataLengths };
}

export function lastMatchingTopic(
  msgEvents: Immutable<MessageEvent[]>,
  topic: string,
): MessageEvent | undefined {
  for (let i = msgEvents.length - 1; i >= 0; --i) {
    const msgEvent = msgEvents[i]!;
    if (msgEvent.topic === topic) {
      return msgEvent;
    }
  }

  return undefined;
}

type SeriesCurrentAction<T> =
  | { type: "reset-current"; series: SeriesConfigKey }
  | { type: "append-current"; series: SeriesConfigKey; items: T[] };

/**
 * Iterates over each series, optionally pushing a reset-current action when a seek occurred,
 * then appending the items returned by `getItems`. Returns whether any series produced items.
 *
 * When a range source is available (e.g. file/bag topics), a seek always triggers a reset because
 * the range subscription will reload the full history. When no range source exists (e.g. UserScript
 * output topics), the reset is skipped entirely because the accumulated data cannot be reloaded
 * and the existing points remain valid regardless of seek direction.
 *
 * Shared by TimestampDatasetsBuilder and CustomDatasetsBuilder for current-frame y-series
 * processing.
 */
export function buildCurrentSeriesActions<TItem>(
  series: Immutable<Array<{ config: Immutable<SeriesItem> }>>,
  options: { didSeek: boolean; hasRangeSource: boolean },
  getItems: (config: Immutable<SeriesItem>) => TItem[],
): { actions: SeriesCurrentAction<TItem>[]; datasetsChanged: boolean } {
  let datasetsChanged = false;
  const actions: SeriesCurrentAction<TItem>[] = [];
  const shouldReset = options.didSeek && options.hasRangeSource;
  for (const s of series) {
    if (shouldReset) {
      actions.push({ type: "reset-current", series: s.config.key });
    }
    const items = getItems(s.config);
    datasetsChanged ||= items.length > 0;
    actions.push({ type: "append-current", series: s.config.key, items });
  }
  return { actions, datasetsChanged };
}

type SeriesFullAction<T> =
  | { type: "reset-full"; series: SeriesConfigKey }
  | { type: "append-full"; series: SeriesConfigKey; items: T[] };

/**
 * Iterates over each series whose topic matches `topic`, optionally pushing a reset-full action
 * when isReset is true, then appending non-empty items returned by `getItems`.
 *
 * Shared by TimestampDatasetsBuilder and CustomDatasetsBuilder for range y-series processing.
 */
export function buildFullSeriesActions<TItem>(
  series: Immutable<Array<{ config: Immutable<SeriesItem> }>>,
  topic: string,
  options: { isReset: boolean },
  getItems: (config: Immutable<SeriesItem>) => TItem[],
): SeriesFullAction<TItem>[] {
  const actions: SeriesFullAction<TItem>[] = [];
  for (const s of series) {
    if (s.config.parsed.topicName !== topic) {
      continue;
    }
    if (options.isReset) {
      actions.push({ type: "reset-full", series: s.config.key });
    }
    const items = getItems(s.config);
    if (items.length > 0) {
      actions.push({ type: "append-full", series: s.config.key, items });
    }
  }
  return actions;
}
