// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppEvent } from "../IAnalytics";
import { Attributes, MetricName } from "../ITelemetry";

/**
 * Fixed allowlist of attribute keys that are safe to attach to *metrics* (Prometheus labels).
 * This is the first cardinality barrier (the collector has a second one, see
 * docs/telemetry/poc/otel-collector.yaml) — never add device/user identifiers, file paths, topic
 * names or free-form text here. See docs/telemetry/poc-opentelemetry-plano.md section 6.
 *
 * `session_id` is a deliberate, narrow exception: it is only ever used on the heap gauge
 * (`lichtblick.memory.heap.used`), which has short retention by design (see plan section 6) — it
 * must never be added to a Counter/Histogram.
 */
export const METRIC_ATTRIBUTE_ALLOWLIST = new Set([
  "panel_type",
  "action",
  "reason",
  "exit_code",
  "process_type",
  "app_version",
  "platform",
  "os_type",
  "session_id",
  // Interaction heatmap PoC (docs/telemetry/interaction-heatmap-poc-plan.md WS-1) — `nx`/`ny` are
  // deliberately NOT here, see InteractionAttributes in ./interactionTypes.ts.
  "target_id",
  "target_kind",
  "size_bucket",
]);

/**
 * OTel unit (UCUM) for each metric. The collector's Prometheus exporter appends the matching unit
 * suffix to the exported series name (`By` -> `_bytes`, `s` -> `_seconds`), which is what the
 * provisioned dashboard queries — an instrument declared without a unit exports with no suffix and
 * silently mismatches those queries.
 */
export const METRIC_UNITS: Record<MetricName, string> = {
  "lichtblick.memory.heap.used": "By",
  "lichtblick.memory.process.rss": "By",
  "lichtblick.session.duration": "s",
};

/**
 * Maps a subset of `AppEvent`s to a Prometheus counter name. Events not listed here still reach
 * Loki (via the log line emitted alongside) but never become a metric — the PoC explicitly does
 * not instrument every event the `AppEvent` enum declares (see plan section 2).
 */
const EVENT_COUNTER_NAME: Partial<Record<AppEvent, string>> = {
  [AppEvent.APP_INIT]: "lichtblick.session.start",
  [AppEvent.SESSION_HEARTBEAT]: "lichtblick.session.heartbeat",
  [AppEvent.PANEL_ADD]: "lichtblick.panel.added",
  [AppEvent.PANEL_DELETE]: "lichtblick.panel.removed",
  [AppEvent.RENDERER_GONE]: "lichtblick.renderer.gone",
  [AppEvent.UI_INTERACTION]: "lichtblick.ui.interaction",
};

/**
 * Per-event attribute renames, applied before the allowlist. The existing call sites send a generic
 * `type` key (CurrentLayoutProvider emits PANEL_ADD as `{ type: "Plot" }`) and the plan requires
 * leaving those ~40 call sites untouched, so the rename happens here instead.
 *
 * `type` deliberately stays OUT of `METRIC_ATTRIBUTE_ALLOWLIST`: other events reuse the same key for
 * unbounded values (EXTENSION_INSTALL sends an extension id), which must never become a label.
 */
const EVENT_ATTRIBUTE_RENAMES: Partial<Record<AppEvent, Readonly<Record<string, string>>>> = {
  [AppEvent.PANEL_ADD]: { type: "panel_type" },
  [AppEvent.PANEL_DELETE]: { type: "panel_type" },
};

/** Returns the counter name for `event`, or undefined if it should stay log-only. */
export function getEventCounterName(event: AppEvent): string | undefined {
  return EVENT_COUNTER_NAME[event];
}

/**
 * Applies `event`'s attribute renames (if any) and then drops every attribute not in
 * `METRIC_ATTRIBUTE_ALLOWLIST`, before anything reaches a metric label.
 */
export function sanitizeMetricAttributes(
  attrs: Attributes | undefined,
  event?: AppEvent,
): Attributes {
  if (!attrs) {
    return {};
  }
  const renames = event == undefined ? undefined : EVENT_ATTRIBUTE_RENAMES[event];
  const sanitized: Attributes = {};
  for (const [key, value] of Object.entries(attrs)) {
    const metricKey = renames?.[key] ?? key;
    if (METRIC_ATTRIBUTE_ALLOWLIST.has(metricKey)) {
      sanitized[metricKey] = value;
    }
  }
  return sanitized;
}

/** Stable string key for a set of attributes, used to key per-attribute-combination gauge values. */
export function attributesCacheKey(attrs: Attributes): string {
  // Object.entries() of a plain Attributes object always serializes; the `?? ""` only satisfies
  // the repo-wide JSON.stringify typing override (typings/overrides.d.ts), never actually hit.
  return JSON.stringify(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b))) ?? "";
}
