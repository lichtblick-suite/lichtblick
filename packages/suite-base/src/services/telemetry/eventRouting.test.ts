// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import { InteractionAttributes } from "@lichtblick/suite-base/services/telemetry/interactionTypes";

import {
  METRIC_ATTRIBUTE_ALLOWLIST,
  METRIC_UNITS,
  attributesCacheKey,
  getEventCounterName,
  sanitizeMetricAttributes,
} from "./eventRouting";

describe("getEventCounterName", () => {
  it("maps the events the PoC promotes to a Prometheus counter", () => {
    // Given/When/Then: only the explicitly listed events become metrics
    expect(getEventCounterName(AppEvent.APP_INIT)).toEqual("lichtblick.session.start");
    expect(getEventCounterName(AppEvent.SESSION_HEARTBEAT)).toEqual("lichtblick.session.heartbeat");
    expect(getEventCounterName(AppEvent.PANEL_ADD)).toEqual("lichtblick.panel.added");
    expect(getEventCounterName(AppEvent.PANEL_DELETE)).toEqual("lichtblick.panel.removed");
    expect(getEventCounterName(AppEvent.RENDERER_GONE)).toEqual("lichtblick.renderer.gone");
    expect(getEventCounterName(AppEvent.UI_INTERACTION)).toEqual("lichtblick.ui.interaction");
  });

  it("returns undefined for events that must stay log-only", () => {
    // Given: an event not on the allowlist (most of the ~40 declared AppEvents)
    // When/Then: no counter name is produced
    expect(getEventCounterName(AppEvent.LAYOUT_RENAME)).toBeUndefined();
    expect(getEventCounterName(AppEvent.EXTENSION_INSTALL)).toBeUndefined();
  });
});

describe("sanitizeMetricAttributes", () => {
  it("returns an empty object when no attributes are given", () => {
    expect(sanitizeMetricAttributes(undefined)).toEqual({});
  });

  it("keeps only allowlisted attribute keys", () => {
    // Given: a mix of safe and unsafe attributes (device_id/topic are never safe for a metric label)
    const attrs = {
      panel_type: "3D",
      device_id: "should-not-leak-into-a-metric-label",
      topic: "/should/not/leak",
      reason: "oom",
    };

    // When
    const sanitized = sanitizeMetricAttributes(attrs);

    // Then
    expect(sanitized).toEqual({ panel_type: "3D", reason: "oom" });
  });
});

describe("sanitizeMetricAttributes (per-event renames)", () => {
  it("renames the panel events' generic `type` key to `panel_type`", () => {
    // Given: CurrentLayoutProvider emits PANEL_ADD as { type: "Plot" } and must not be changed
    // When: the attributes are sanitized for the metric
    // Then: the value survives under the allowlisted label name, so `sum by (panel_type)` works
    expect(sanitizeMetricAttributes({ type: "Plot" }, AppEvent.PANEL_ADD)).toEqual({
      panel_type: "Plot",
    });
    expect(sanitizeMetricAttributes({ type: "3D", action: "swap" }, AppEvent.PANEL_DELETE)).toEqual(
      {
        panel_type: "3D",
        action: "swap",
      },
    );
  });

  it("does not rename `type` for other events, keeping unbounded values out of labels", () => {
    // Given: EXTENSION_INSTALL reuses `type` for an extension id (unbounded cardinality)
    // Then: it is dropped rather than promoted to a label
    expect(
      sanitizeMetricAttributes({ type: "some.extension.id" }, AppEvent.EXTENSION_INSTALL),
    ).toEqual({});
    expect(sanitizeMetricAttributes({ type: "Plot" })).toEqual({});
  });
});

describe("attributesCacheKey", () => {
  it("produces the same key regardless of attribute insertion order", () => {
    // Given: the same attributes in two different orders
    const a = { panel_type: "3D", action: "add" };
    const b = { action: "add", panel_type: "3D" };

    // When/Then
    expect(attributesCacheKey(a)).toEqual(attributesCacheKey(b));
  });

  it("produces different keys for different attribute values", () => {
    expect(attributesCacheKey({ panel_type: "3D" })).not.toEqual(
      attributesCacheKey({ panel_type: "Plot" }),
    );
  });
});

describe("METRIC_UNITS", () => {
  it("declares a UCUM unit for every metric, which the dashboard queries depend on", () => {
    // Given: the collector's Prometheus exporter derives the series suffix from the unit
    // (By -> _bytes, s -> _seconds). When: a metric ships without a unit. Then: the provisioned
    // dashboard queries silently return no data — so every MetricName must appear here.
    expect(METRIC_UNITS).toEqual({
      "lichtblick.memory.heap.used": "By",
      "lichtblick.memory.process.rss": "By",
      "lichtblick.session.duration": "s",
    });
  });
});

describe("sanitizeMetricAttributes (interaction heatmap PoC privacy contract)", () => {
  it("strips nx/ny from a full UI_INTERACTION payload before it can reach a metric label", () => {
    // Given: the full attribute set logEvent() sends for every interaction (see
    // interactionTypes.ts) — nx/ny are a quantized click position, never safe as a label.
    const attrs: InteractionAttributes = {
      panel_type: "ThreeDeeRender",
      target_id: "panel.toolbar.settings",
      target_kind: "control",
      size_bucket: "l",
      nx: 12,
      ny: 5,
    };

    // When
    const sanitized = sanitizeMetricAttributes(attrs, AppEvent.UI_INTERACTION);

    // Then: this fails the build the moment nx/ny (or any future coordinate field) is added to
    // the allowlist, turning the privacy rule from a comment into a test.
    expect(sanitized).toEqual({
      panel_type: "ThreeDeeRender",
      target_id: "panel.toolbar.settings",
      target_kind: "control",
      size_bucket: "l",
    });
    expect(Object.keys(sanitized)).not.toContain("nx");
    expect(Object.keys(sanitized)).not.toContain("ny");
  });

  it("never allowlists nx or ny directly", () => {
    expect(METRIC_ATTRIBUTE_ALLOWLIST.has("nx")).toBe(false);
    expect(METRIC_ATTRIBUTE_ALLOWLIST.has("ny")).toBe(false);
  });
});
