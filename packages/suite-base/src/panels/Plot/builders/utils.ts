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
      borderColor: item.color,
      showLine: item.showLine,
      fill: false,
      borderWidth: item.lineSize,
      pointRadius: item.lineSize * 1.2,
      pointHoverRadius: 3,
      pointBackgroundColor: item.showLine ? item.contrastColor : item.color,
      pointBorderColor: "transparent",
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
      datasets[series.configIndex] = series.dataset as Dataset;
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
 * Shared by TimestampDatasetsBuilder and CustomDatasetsBuilder for current-frame y-series
 * processing.
 */
export function buildCurrentSeriesActions<TItem>(
  series: Immutable<Array<{ config: Immutable<SeriesItem> }>>,
  options: { didSeek: boolean },
  getItems: (config: Immutable<SeriesItem>) => TItem[],
): { actions: SeriesCurrentAction<TItem>[]; datasetsChanged: boolean } {
  let datasetsChanged = false;
  const actions: SeriesCurrentAction<TItem>[] = [];
  for (const s of series) {
    if (options.didSeek) {
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
