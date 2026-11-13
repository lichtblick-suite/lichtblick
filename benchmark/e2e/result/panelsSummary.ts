// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Per-panel summary of the panel telemetry (`summary.panels`, `summary.phases.panelsReady*`).
// Pure; free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

import { PANEL_METRICS } from "./constants";
import { PanelAccumulator, PanelEventName } from "./panelsSummary.types";
import { counterTotal, indexByMetric, observationMetrics, summarizeObservation } from "./series";
import { maxOf } from "./stats";
import type {
  TelemetryEvent,
  TelemetrySample,
} from "../../../packages/suite-base/src/util/telemetry/types";

const PANEL_METRIC_NAMES: ReadonlySet<string> = new Set([
  ...Object.values(PANEL_METRICS),
  ...Object.values(observationMetrics(PANEL_METRICS.renderDurationMs)),
]);

/**
 * One panel of the layout, keyed by its layout id (e.g. `Plot!abc`) in `summary.panels`.
 * Times (`*Ms`) are relative to the phases origin (`summary.phases.origin`) and omitted without one.
 */
export type PanelSummaryV1 = {
  panelType: string;
  /** First `panel.mount`. */
  mountedAtMs?: number;
  /** First `panel.unmount` after the first mount (end of the first mounted lifetime). */
  unmountedAtMs?: number;
  /** First `panel.firstRender` (emitted by `PanelExtensionAdapter` panels only). */
  firstRenderMs?: number;
  /** Number of `panel.mount` events (> 1: the panel was remounted during the run). */
  mounts: number;
  /**
   * Final `panel.messages.delivered` total (0 if never published): messages the pipeline
   * delivered to the panel's subscribers, for every panel type.
   */
  messages: number;
  /** Final `panel.messages.deliveredBytes` total (0 if never published). */
  messageBytes: number;
  /** Final `panel.rangeMessages.delivered` total (0 if never published). */
  rangeMessages: number;
  /** Final `panel.rangeMessages.deliveredBytes` total (0 if never published). */
  rangeBytes: number;
  /**
   * Final `panel.messages.rendered` total: messages of the frames an adapter panel actually
   * rendered (adapter panels only; absent in older artifacts).
   */
  renderedMessages?: number;
  /** Final `panel.messages.renderedBytes` total (adapter panels only; absent in older artifacts). */
  renderedBytes?: number;
  /** Final `panel.render.count` total, else `panel.render.durationMs.count` (adapter panels only). */
  renders?: number;
  /** `panel.render.durationMs`: Σsum / Σcount over the run. */
  renderMeanMs?: number;
  /** `panel.render.durationMs`: maximum of the per-window `.max`. */
  renderMaxMs?: number;
  /** `panel.render.durationMs`: p90 of the per-window `.max` (spike indicator). */
  renderP90WindowMaxMs?: number;
  /** Final `panel.render.skipped` total (adapter panels only). */
  skipped?: number;
};

export type PanelsReadyCoverageV1 = {
  /** Panels with at least one `panel.mount`. */
  mounted: number;
  /** Panels with at least one `panel.firstRender` (built-in React panels never emit it). */
  firstRendered: number;
};

export type PanelsReadyV1 = {
  /**
   * Latest per-panel first `panel.firstRender` among the panels that emitted one; if none did, the
   * latest per-panel first `panel.mount`. Relative to the phases origin.
   */
  panelsReadyMs?: number;
  panelsReadyCoverage?: PanelsReadyCoverageV1;
};

function isPanelEventName(name: string): name is PanelEventName {
  return name === "panel.mount" || name === "panel.unmount" || name === "panel.firstRender";
}

function minOf(values: readonly number[]): number | undefined {
  let result: number | undefined;
  for (const value of values) {
    result = result == undefined || value < result ? value : result;
  }
  return result;
}

function collectPanels(
  pageSamples: readonly TelemetrySample[],
  events: readonly TelemetryEvent[],
): Map<string, PanelAccumulator> {
  const panels = new Map<string, PanelAccumulator>();
  const panelFor = (panelId: string, panelType: string | undefined): PanelAccumulator => {
    let panel = panels.get(panelId);
    if (panel == undefined) {
      panel = {
        panelType: panelType ?? "unknown",
        events: { "panel.mount": [], "panel.unmount": [], "panel.firstRender": [] },
        samples: [],
      };
      panels.set(panelId, panel);
    } else if (panel.panelType === "unknown" && panelType != undefined) {
      panel.panelType = panelType;
    }
    return panel;
  };
  for (const event of events) {
    const panelId = event.labels?.panelId;
    if (panelId == undefined || !isPanelEventName(event.name)) {
      continue;
    }
    panelFor(panelId, event.labels?.panelType).events[event.name].push(event.monotonicTs);
  }
  for (const sample of pageSamples) {
    const panelId = sample.labels?.panelId;
    if (panelId == undefined || !PANEL_METRIC_NAMES.has(sample.metric)) {
      continue;
    }
    panelFor(panelId, sample.labels?.panelType).samples.push(sample);
  }
  return panels;
}

function summarizePanel(panel: PanelAccumulator, originTs: number | undefined): PanelSummaryV1 {
  const metrics = indexByMetric(panel.samples);
  const relative = (ts: number | undefined) =>
    ts == undefined || originTs == undefined ? undefined : ts - originTs;
  const mounts = panel.events["panel.mount"];
  const firstMountTs = minOf(mounts);
  const unmountTs = minOf(
    panel.events["panel.unmount"].filter((ts) => firstMountTs == undefined || ts >= firstMountTs),
  );

  const summary: PanelSummaryV1 = {
    panelType: panel.panelType,
    mounts: mounts.length,
    messages: counterTotal(metrics.get(PANEL_METRICS.messagesDelivered)) ?? 0,
    messageBytes: counterTotal(metrics.get(PANEL_METRICS.messagesDeliveredBytes)) ?? 0,
    rangeMessages: counterTotal(metrics.get(PANEL_METRICS.rangeMessagesDelivered)) ?? 0,
    rangeBytes: counterTotal(metrics.get(PANEL_METRICS.rangeMessagesDeliveredBytes)) ?? 0,
  };
  const mountedAtMs = relative(firstMountTs);
  const unmountedAtMs = relative(unmountTs);
  const firstRenderMs = relative(minOf(panel.events["panel.firstRender"]));
  if (mountedAtMs != undefined) {
    summary.mountedAtMs = mountedAtMs;
  }
  if (unmountedAtMs != undefined) {
    summary.unmountedAtMs = unmountedAtMs;
  }
  if (firstRenderMs != undefined) {
    summary.firstRenderMs = firstRenderMs;
  }

  const renderedMessages = counterTotal(metrics.get(PANEL_METRICS.messagesRendered));
  if (renderedMessages != undefined) {
    summary.renderedMessages = renderedMessages;
  }
  const renderedBytes = counterTotal(metrics.get(PANEL_METRICS.messagesRenderedBytes));
  if (renderedBytes != undefined) {
    summary.renderedBytes = renderedBytes;
  }

  const durations = summarizeObservation(metrics, PANEL_METRICS.renderDurationMs);
  const renders = counterTotal(metrics.get(PANEL_METRICS.renderCount)) ?? durations?.count;
  if (renders != undefined) {
    summary.renders = renders;
  }
  if (durations?.mean != undefined) {
    summary.renderMeanMs = durations.mean;
  }
  if (durations?.max != undefined) {
    summary.renderMaxMs = durations.max;
  }
  if (durations?.p90WindowMax != undefined) {
    summary.renderP90WindowMaxMs = durations.p90WindowMax;
  }
  const skipped = counterTotal(metrics.get(PANEL_METRICS.renderSkipped));
  if (skipped != undefined) {
    summary.skipped = skipped;
  }
  return summary;
}

/**
 * Builds `summary.panels`: one entry per layout panel id seen in a panel event or a panel metric
 * (sorted by id). Counter totals are the last cumulative value per series. Undefined when the run
 * has no panel telemetry.
 *
 * @param originTs Absolute `monotonicTs` of the phases origin; times are omitted when undefined.
 */
export function summarizePanels(
  pageSamples: readonly TelemetrySample[],
  events: readonly TelemetryEvent[],
  originTs: number | undefined,
): Record<string, PanelSummaryV1> | undefined {
  const panels = collectPanels(pageSamples, events);
  if (panels.size === 0) {
    return undefined;
  }
  const result: Record<string, PanelSummaryV1> = {};
  for (const panelId of [...panels.keys()].sort((a, b) => a.localeCompare(b))) {
    result[panelId] = summarizePanel(panels.get(panelId)!, originTs);
  }
  return result;
}

/** Keeps the earliest `monotonicTs` per panel id in `target`. */
function keepEarliest(target: Map<string, number>, panelId: string, monotonicTs: number): void {
  const existing = target.get(panelId);
  if (existing == undefined || monotonicTs < existing) {
    target.set(panelId, monotonicTs);
  }
}

/**
 * Builds `panelsReadyMs` / `panelsReadyCoverage` (see `PanelsReadyV1`). Coverage is reported
 * whenever a panel mounted or rendered; `panelsReadyMs` additionally needs an origin.
 */
export function summarizePanelsReady(
  events: readonly TelemetryEvent[],
  originTs: number | undefined,
): PanelsReadyV1 {
  const firstMount = new Map<string, number>();
  const firstRender = new Map<string, number>();
  for (const event of events) {
    const panelId = event.labels?.panelId;
    if (panelId == undefined) {
      continue;
    }
    if (event.name === "panel.mount") {
      keepEarliest(firstMount, panelId, event.monotonicTs);
    } else if (event.name === "panel.firstRender") {
      keepEarliest(firstRender, panelId, event.monotonicTs);
    }
  }
  if (firstMount.size === 0 && firstRender.size === 0) {
    return {};
  }
  const ready: PanelsReadyV1 = {
    panelsReadyCoverage: { mounted: firstMount.size, firstRendered: firstRender.size },
  };
  const readyTs = maxOf([...(firstRender.size > 0 ? firstRender : firstMount).values()]);
  if (readyTs != undefined && originTs != undefined) {
    ready.panelsReadyMs = readyTs - originTs;
  }
  return ready;
}
