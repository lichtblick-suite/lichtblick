// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MutableRefObject, useEffect, useRef } from "react";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import { InteractionAttributes } from "@lichtblick/suite-base/services/telemetry/interactionTypes";
import { RateLimiter } from "@lichtblick/suite-base/services/telemetry/rateLimiter";

/**
 * Grid resolution for the quantized click position — coarse enough that no precise pointer
 * position is ever stored, fine enough for a legible heatmap. See
 * docs/telemetry/interaction-heatmap-poc-plan.md WS-2/WS-6 (the 16x16 fallback mentioned there
 * is a rendering-time concern for sparse data, not a capture-time one, so it is not modeled here).
 */
const GRID_SIZE = 32;

/**
 * Token-bucket defaults for the per-session interaction rate limit. Deliberately conservative —
 * WS-6 measures real event rate and tunes these before the implementation story inherits them.
 */
const RATE_LIMIT_PER_MINUTE = 120;
const RATE_LIMIT_BURST = 20;

/** Prometheus-only counter (never a log line) incremented once per event the limiter rejects. */
export const DROPPED_COUNTER_NAME = "lichtblick.telemetry.dropped";

/** Panel footprint thresholds (px^2), coarse and PoC-tunable — see `bucketOf`. */
const SIZE_BUCKET_THRESHOLDS: ReadonlyArray<
  readonly [maxAreaExclusive: number, bucket: InteractionAttributes["size_bucket"]]
> = [
  [150_000, "s"],
  [400_000, "m"],
  [900_000, "l"],
];

type UseInteractionCaptureArgs = {
  /** The panel's own root element — the same ref Panel.tsx assigns to `<PanelRoot ref={...} />`. */
  rootRef: MutableRefObject<HTMLDivElement | ReactNull>;
  panelType: string;
  panelId: string;
};

/**
 * Captures pointerdown interactions anywhere inside a panel's root and reports them as
 * `AppEvent.UI_INTERACTION`, plus `AppEvent.PANEL_FOCUS` the first time a click moves focus into
 * the panel. See docs/telemetry/interaction-heatmap-poc-plan.md WS-2/WS-3 for the full design.
 *
 * Uses a native capture-phase listener rather than `PanelRoot`'s existing bubble-phase `onClick`:
 * inner components (notably the 3D panel's orbit controls) call `stopPropagation()`, which would
 * silently hide those clicks from a bubble-phase handler.
 */
export function useInteractionCapture({
  rootRef,
  panelType,
  panelId,
}: UseInteractionCaptureArgs): void {
  const telemetry = useAnalytics();
  const rectRef = useRef<DOMRectReadOnly | undefined>(undefined);
  const limiterRef = useRef<RateLimiter | undefined>(undefined);
  limiterRef.current ??= new RateLimiter({
    ratePerMinute: RATE_LIMIT_PER_MINUTE,
    burst: RATE_LIMIT_BURST,
  });

  // Cache the root's viewport rect instead of reading it inside the pointerdown handler below:
  // getBoundingClientRect() forces layout, which is acceptable on a resize but not on the click
  // hot path. Note this reads getBoundingClientRect() itself rather than the ResizeObserver
  // entry's contentRect, which is relative to the element's own border box, not the viewport —
  // exactly the coordinates the pointerdown handler needs. This misses position drift that isn't
  // accompanied by a size change (e.g. a sibling mosaic split resizing without resizing this
  // panel) — an accepted approximation for the PoC.
  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const refreshRect = () => {
      rectRef.current = element.getBoundingClientRect();
    };
    refreshRect();

    const observer = new ResizeObserver(refreshRect);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [rootRef]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const rect = rectRef.current;
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return;
      }

      // Read before the browser moves focus, so this needs no cross-panel shared state: a click
      // whose target isn't already inside this panel is, by definition, moving focus into it.
      if (!element.contains(document.activeElement)) {
        telemetry.logEvent(AppEvent.PANEL_FOCUS, { panel_type: panelType });
      }

      if (limiterRef.current?.tryAcquire() !== true) {
        telemetry.incrementCounter(DROPPED_COUNTER_NAME, { reason: "rate_limited" });
        return;
      }

      const target =
        event.target instanceof Element ? event.target.closest("[data-analytics-id]") : ReactNull;
      const targetId = target instanceof HTMLElement ? target.dataset.analyticsId : undefined;
      const attrs: InteractionAttributes = {
        panel_type: panelType,
        target_id: targetId ?? "unlabeled",
        target_kind: target ? "control" : "surface",
        size_bucket: bucketOf(rect),
        nx: quantize((event.clientX - rect.left) / rect.width),
        ny: quantize((event.clientY - rect.top) / rect.height),
      };
      telemetry.logEvent(AppEvent.UI_INTERACTION, attrs);
    };

    element.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    return () => {
      element.removeEventListener("pointerdown", onPointerDown, { capture: true });
    };
    // panelId isn't read directly, but a capture listener is conceptually scoped to one logical
    // panel instance, so it re-subscribes if the panel's identity changes underneath the same ref.
  }, [rootRef, panelType, panelId, telemetry]);
}

/** Clamps `fraction` (expected 0..1, but clicks can land slightly outside due to borders) to a grid cell. */
function quantize(fraction: number): number {
  return Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(fraction * GRID_SIZE)));
}

function bucketOf(rect: DOMRectReadOnly): InteractionAttributes["size_bucket"] {
  const area = rect.width * rect.height;
  for (const [maxAreaExclusive, bucket] of SIZE_BUCKET_THRESHOLDS) {
    if (area < maxAreaExclusive) {
      return bucket;
    }
  }
  return "xl";
}
