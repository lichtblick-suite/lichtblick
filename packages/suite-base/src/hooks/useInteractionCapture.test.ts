/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";
import { MutableRefObject } from "react";

import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";

import { DROPPED_COUNTER_NAME, useInteractionCapture } from "./useInteractionCapture";

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

/** Stubs `getBoundingClientRect()` so the hook's cached rect is deterministic in jsdom. */
function stubRect(element: HTMLElement, rect: Partial<DOMRect>) {
  jest.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
    toJSON: () => ({}),
    ...rect,
  });
}

function dispatchPointerDown(target: EventTarget, init: MouseEventInit) {
  // jsdom's PointerEvent support is inconsistent across versions; addEventListener("pointerdown")
  // matches on the event's `type` string, so a MouseEvent constructed with that type is enough —
  // see Renderer.test.ts for the repo's existing convention of using MouseEvent for pointer input.
  target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, ...init }));
}

function setup(panelType = "3D", rect: Partial<DOMRect> = {}) {
  const logEvent = jest.fn();
  const incrementCounter = jest.fn();
  (useAnalytics as jest.Mock).mockReturnValue({ logEvent, incrementCounter });

  const root = document.createElement("div");
  document.body.appendChild(root);
  // Stubbed before the hook mounts: the hook caches this via ResizeObserver at mount time (see
  // ResizeObserverMock in test/setup.ts, which invokes its callback once, synchronously, from
  // `.observe()`), so changing the stub after `renderHook` would not be picked up again.
  stubRect(root, rect);
  const rootRef: MutableRefObject<HTMLDivElement | ReactNull> = { current: root };

  renderHook(() => {
    useInteractionCapture({ rootRef, panelType, panelId: "panel-1" });
  });

  return { root, logEvent, incrementCounter };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useInteractionCapture", () => {
  it("reports a click on the panel's own surface when no annotated ancestor exists", () => {
    // Given: a 100x100 panel root with no data-analytics-id anywhere inside it
    const { root, logEvent } = setup("ThreeDeeRender");

    // When: the user clicks its center
    dispatchPointerDown(root, { clientX: 50, clientY: 50 });

    // Then: the click is attributed to the panel's surface, at the expected grid cell
    expect(logEvent).toHaveBeenCalledWith(AppEvent.UI_INTERACTION, {
      panel_type: "ThreeDeeRender",
      target_id: "unlabeled",
      target_kind: "surface",
      size_bucket: "s",
      nx: 16,
      ny: 16,
    });
  });

  it("resolves target_id/target_kind from the nearest data-analytics-id ancestor", () => {
    // Given: a button annotated for the taxonomy pilot, nested inside the panel root
    const { root, logEvent } = setup("ThreeDeeRender");
    const button = document.createElement("button");
    button.setAttribute("data-analytics-id", "panel.toolbar.settings");
    root.appendChild(button);

    // When: the click lands on the button, not the bare panel surface
    dispatchPointerDown(button, { clientX: 10, clientY: 10 });

    // Then: the resolved control identity is reported, not "unlabeled"/"surface"
    expect(logEvent).toHaveBeenCalledWith(
      AppEvent.UI_INTERACTION,
      expect.objectContaining({
        target_id: "panel.toolbar.settings",
        target_kind: "control",
      }),
    );
  });

  it("quantizes the click position to the 32x32 grid rather than storing raw pixels", () => {
    // Given
    const { root, logEvent } = setup();

    // When: a click near the bottom-right corner of a 100x100 panel
    dispatchPointerDown(root, { clientX: 99, clientY: 1 });

    // Then
    expect(logEvent).toHaveBeenCalledWith(
      AppEvent.UI_INTERACTION,
      expect.objectContaining({ nx: 31, ny: 0 }),
    );
  });

  it("emits PANEL_FOCUS only on the interaction that first moves focus into the panel", () => {
    // Given: a focusable root, and jsdom's default focus (document.body) outside of it
    const { root, logEvent } = setup();
    root.tabIndex = -1;

    // When: the first click lands
    dispatchPointerDown(root, { clientX: 10, clientY: 10 });

    // Then: PANEL_FOCUS fires because focus was previously outside the panel
    expect(logEvent).toHaveBeenCalledWith(AppEvent.PANEL_FOCUS, { panel_type: "3D" });

    // When: focus has now genuinely moved into the panel (as a real click would cause) and a
    // second click lands
    logEvent.mockClear();
    root.focus();
    dispatchPointerDown(root, { clientX: 20, clientY: 20 });

    // Then: PANEL_FOCUS does not fire again
    expect(logEvent).not.toHaveBeenCalledWith(AppEvent.PANEL_FOCUS, expect.anything());
  });

  it("stops reporting after unmount", () => {
    // Given
    const logEvent = jest.fn();
    (useAnalytics as jest.Mock).mockReturnValue({ logEvent, incrementCounter: jest.fn() });
    const root = document.createElement("div");
    document.body.appendChild(root);
    stubRect(root, {});
    const rootRef: MutableRefObject<HTMLDivElement | ReactNull> = { current: root };

    const { unmount } = renderHook(() => {
      useInteractionCapture({ rootRef, panelType: "3D", panelId: "panel-1" });
    });

    // When
    unmount();
    dispatchPointerDown(root, { clientX: 10, clientY: 10 });

    // Then: the capture-phase listener was removed, so nothing is reported
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("ignores clicks while the panel has zero size (e.g. mid fullscreen transition)", () => {
    // Given: a root whose cached rect is degenerate from the moment it is observed
    const { root, logEvent } = setup("3D", { width: 0, height: 0 });

    // When
    dispatchPointerDown(root, { clientX: 10, clientY: 10 });

    // Then: nx/ny would be NaN/Infinity, so the event is dropped rather than sent malformed
    expect(logEvent).not.toHaveBeenCalledWith(AppEvent.UI_INTERACTION, expect.anything());
  });

  describe("rate limiting", () => {
    it("bounds a burst of 1000 synthetic clicks and drops the remainder with a matching count", () => {
      // Given
      const { root, logEvent, incrementCounter } = setup();

      // When: 1000 clicks arrive back-to-back, far above the token bucket's capacity
      for (let i = 0; i < 1000; i++) {
        dispatchPointerDown(root, { clientX: 10, clientY: 10 });
      }

      // Then: only a bounded number of interactions are exported...
      const allowed = logEvent.mock.calls.filter(
        ([event]: [AppEvent]) => event === AppEvent.UI_INTERACTION,
      ).length;
      // ...and every drop is accounted for by the dedicated (log-free) counter, never silently lost
      const dropped = incrementCounter.mock.calls.filter(
        ([name]: [string]) => name === DROPPED_COUNTER_NAME,
      ).length;

      expect(allowed).toBeGreaterThan(0);
      expect(allowed).toBeLessThan(50); // far below 1000 — the actual bound is the burst size
      expect(dropped).toBe(1000 - allowed);
      expect(incrementCounter).toHaveBeenCalledWith(DROPPED_COUNTER_NAME, {
        reason: "rate_limited",
      });
    });
  });
});
