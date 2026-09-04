/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react";
import { createElement, MouseEvent, ReactNode } from "react";

import AnalyticsContext from "@lichtblick/suite-base/context/AnalyticsContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import type IAnalytics from "@lichtblick/suite-base/services/IAnalytics";

import { useInteractionCapture } from "./useInteractionCapture";

function makeWrapper(analytics: IAnalytics) {
  return function Wrapper({ children }: { children: ReactNode }): ReturnType<typeof createElement> {
    return createElement(AnalyticsContext.Provider, { value: analytics }, children);
  };
}

function makeDomEvent(target: EventTarget | null): MouseEvent {
  return { target } as MouseEvent;
}

describe("useInteractionCapture", () => {
  let logEvent: jest.Mock;
  let analytics: IAnalytics;

  beforeEach(() => {
    logEvent = jest.fn();
    analytics = { logEvent };
  });

  it("logs the event with the target element's data-testid by default", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const target = document.createElement("button");
    target.setAttribute("data-testid", "menu-item-open");
    const { result } = renderHook(() => useInteractionCapture(AppEvent.APP_MENU_CLICK), {
      wrapper,
    });

    // When
    act(() => {
      result.current(makeDomEvent(target));
    });

    // Then
    expect(logEvent).toHaveBeenCalledWith(AppEvent.APP_MENU_CLICK, { id: "menu-item-open" });
  });

  it("uses the nearest ancestor carrying the identifying attribute", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const ancestor = document.createElement("div");
    ancestor.setAttribute("data-testid", "panel-toolbar-button");
    const child = document.createElement("span");
    ancestor.appendChild(child);
    const { result } = renderHook(() => useInteractionCapture(AppEvent.PANEL_INTERACTION), {
      wrapper,
    });

    // When
    act(() => {
      result.current(makeDomEvent(child));
    });

    // Then
    expect(logEvent).toHaveBeenCalledWith(AppEvent.PANEL_INTERACTION, {
      id: "panel-toolbar-button",
    });
  });

  it("does not log when no matching ancestor is found", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const target = document.createElement("div");
    const { result } = renderHook(() => useInteractionCapture(AppEvent.APP_MENU_CLICK), {
      wrapper,
    });

    // When
    act(() => {
      result.current(makeDomEvent(target));
    });

    // Then
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("respects a custom identifying attribute", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const target = document.createElement("button");
    target.setAttribute("data-interaction-id", "custom-target");
    const { result } = renderHook(
      () =>
        useInteractionCapture(AppEvent.PANEL_INTERACTION, {
          attribute: "data-interaction-id",
        }),
      { wrapper },
    );

    // When
    act(() => {
      result.current(makeDomEvent(target));
    });

    // Then
    expect(logEvent).toHaveBeenCalledWith(AppEvent.PANEL_INTERACTION, { id: "custom-target" });
  });

  it("merges static payload data with the discovered identifier", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const target = document.createElement("button");
    target.setAttribute("data-testid", "panel-action");
    const { result } = renderHook(
      () =>
        useInteractionCapture(AppEvent.PANEL_INTERACTION, {
          data: { type: "Dummy" },
        }),
      { wrapper },
    );

    // When
    act(() => {
      result.current(makeDomEvent(target));
    });

    // Then
    expect(logEvent).toHaveBeenCalledWith(AppEvent.PANEL_INTERACTION, {
      type: "Dummy",
      id: "panel-action",
    });
  });

  it("ignores non-Element targets without throwing", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const { result } = renderHook(() => useInteractionCapture(AppEvent.APP_MENU_CLICK), {
      wrapper,
    });

    // When/Then
    expect(() => {
      act(() => {
        result.current(makeDomEvent(null));
      });
    }).not.toThrow();
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("fails closed and does not throw for an invalid attribute name", () => {
    // Given
    const wrapper = makeWrapper(analytics);
    const target = document.createElement("button");
    // An attribute name containing selector-breaking characters would otherwise be
    // interpolated directly into `target.closest()` and could throw a SyntaxError.
    target.setAttribute("data-testid", "menu-item-open");
    const { result } = renderHook(
      () =>
        useInteractionCapture(AppEvent.APP_MENU_CLICK, {
          attribute: 'data-testid]:not([foo="bar',
        }),
      { wrapper },
    );

    // When/Then
    expect(() => {
      act(() => {
        result.current(makeDomEvent(target));
      });
    }).not.toThrow();
    expect(logEvent).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('ignoring invalid attribute name "data-testid]:not([foo="bar"'),
    );
    (console.warn as jest.Mock).mockClear();
  });
});
