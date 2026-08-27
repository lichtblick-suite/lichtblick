// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Attribute contract for `AppEvent.UI_INTERACTION`. This split is the whole privacy argument for
 * the interaction heatmap PoC (see docs/telemetry/interaction-heatmap-poc-plan.md WS-1) and is
 * enforced by eventRouting.test.ts, not just by this comment:
 *
 * - `panel_type`/`target_id`/`target_kind`/`size_bucket` are bounded (panel catalog / static
 *   taxonomy / fixed enums) and safe as Prometheus labels — see METRIC_ATTRIBUTE_ALLOWLIST.
 * - `nx`/`ny` are a quantized click position. They reach Loki (for the spatial heatmap) but must
 *   NEVER be added to METRIC_ATTRIBUTE_ALLOWLIST: unlike the other fields they are not bounded by
 *   a catalog, and a metric label is a cardinality/PII commitment a log line is not.
 */
export type InteractionAttributes = {
  /** Metric label — bounded by the panel catalog (same value PANEL_ADD already sends). */
  panel_type: string;
  /** Metric label — bounded by the static taxonomy pilot (see WS-4), `"unlabeled"` otherwise. */
  target_id: string;
  /** Metric label — whether `target_id` came from an annotated element or the panel's own surface. */
  target_kind: "control" | "surface";
  /** Metric label — coarse panel footprint, never the raw pixel size. */
  size_bucket: "s" | "m" | "l" | "xl";
  /** LOG ONLY — quantized to a 0..31 grid cell. Never add to METRIC_ATTRIBUTE_ALLOWLIST. */
  nx: number;
  /** LOG ONLY — quantized to a 0..31 grid cell. Never add to METRIC_ATTRIBUTE_ALLOWLIST. */
  ny: number;
};
