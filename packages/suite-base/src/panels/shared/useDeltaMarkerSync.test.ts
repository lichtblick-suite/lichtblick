/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { useTimelineInteractionState } from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import useDeltaMarkerSync, { UseDeltaMarkerSyncProps } from "./useDeltaMarkerSync";

jest.mock("@lichtblick/suite-base/context/TimelineInteractionStateContext");

describe("useDeltaMarkerSync", () => {
  let setGlobalDeltaMarkers: jest.Mock;
  let globalDeltaMarkers: any;
  const subscriberId = BasicBuilder.string();

  const renderUseDeltaMarkerSync = (overrides: Partial<UseDeltaMarkerSyncProps> = {}) => {
    const props: UseDeltaMarkerSyncProps = {
      subscriberId,
      enabled: true,
      markerA: undefined,
      markerB: undefined,
      onRemoteMarkers: jest.fn(),
      ...overrides,
    };
    return { ...renderHook((p: UseDeltaMarkerSyncProps) => { useDeltaMarkerSync(p); }, { initialProps: props }), props };
  };

  beforeEach(() => {
    setGlobalDeltaMarkers = jest.fn();
    globalDeltaMarkers = undefined;

    (useTimelineInteractionState as jest.Mock).mockImplementation((selector) => {
      if (selector.name === "selectGlobalDeltaMarkers") {
        return globalDeltaMarkers;
      }
      if (selector.name === "selectSetGlobalDeltaMarkers") {
        return setGlobalDeltaMarkers;
      }
    });
  });

  it("does not broadcast when disabled", () => {
    renderUseDeltaMarkerSync({ enabled: false });

    // The mount-time "release claim" effect may still call setGlobalDeltaMarkers, but it must
    // never end up claiming ownership for this subscriber while disabled.
    for (const call of setGlobalDeltaMarkers.mock.calls) {
      const updater = call[0];
      const result = typeof updater === "function" ? updater(undefined) : updater;
      expect(result).not.toEqual(expect.objectContaining({ sourceId: subscriberId }));
    }
  });

  it("broadcasts local marker x values when enabled", () => {
    renderUseDeltaMarkerSync({
      enabled: true,
      markerA: { xValue: 12, seriesValues: [] },
      markerB: { xValue: 34, seriesValues: [] },
    });

    const updater = setGlobalDeltaMarkers.mock.calls.at(-1)[0];
    expect(updater(undefined)).toEqual({
      sourceId: subscriberId,
      markerAXValue: 12,
      markerBXValue: 34,
    });
  });

  it("re-broadcasts when a local marker x value changes", () => {
    const { rerender, props } = renderUseDeltaMarkerSync({
      enabled: true,
      markerA: { xValue: 12, seriesValues: [] },
    });
    setGlobalDeltaMarkers.mockClear();

    rerender({ ...props, markerA: { xValue: 99, seriesValues: [] } });

    const updater = setGlobalDeltaMarkers.mock.calls.at(-1)[0];
    expect(updater({ sourceId: subscriberId, markerAXValue: 12, markerBXValue: undefined })).toEqual({
      sourceId: subscriberId,
      markerAXValue: 99,
      markerBXValue: undefined,
    });
  });

  it("does not claim ownership when the store already holds these exact values (breaks the ping-pong loop)", () => {
    // Given: another panel already owns the slot with the exact values this panel is about to
    // broadcast (e.g. right after adopting them from a remote update).
    renderUseDeltaMarkerSync({
      enabled: true,
      markerA: { xValue: 12, seriesValues: [] },
      markerB: undefined,
    });

    // When
    const otherOwner = { sourceId: BasicBuilder.string(), markerAXValue: 12, markerBXValue: undefined };
    const updater = setGlobalDeltaMarkers.mock.calls.at(-1)[0];
    const result = updater(otherOwner);

    // Then: the exact same reference is returned, so zustand never notifies subscribers and no
    // further re-broadcast cascade is triggered.
    expect(result).toBe(otherOwner);
  });

  it("ignores global markers broadcast by itself", () => {
    globalDeltaMarkers = { sourceId: subscriberId, markerAXValue: 1, markerBXValue: 2 };
    const onRemoteMarkers = jest.fn();

    renderUseDeltaMarkerSync({ onRemoteMarkers });

    expect(onRemoteMarkers).not.toHaveBeenCalled();
  });

  it("ignores global markers when disabled", () => {
    globalDeltaMarkers = { sourceId: BasicBuilder.string(), markerAXValue: 1, markerBXValue: 2 };
    const onRemoteMarkers = jest.fn();

    renderUseDeltaMarkerSync({ enabled: false, onRemoteMarkers });

    expect(onRemoteMarkers).not.toHaveBeenCalled();
  });

  it("applies a remote marker A placed by another panel", () => {
    globalDeltaMarkers = {
      sourceId: BasicBuilder.string(),
      markerAXValue: 42,
      markerBXValue: undefined,
    };
    const onRemoteMarkers = jest.fn();

    renderUseDeltaMarkerSync({ onRemoteMarkers });

    expect(onRemoteMarkers).toHaveBeenCalledWith(42, undefined);
  });

  it("applies both remote markers together in a single call", () => {
    globalDeltaMarkers = {
      sourceId: BasicBuilder.string(),
      markerAXValue: 42,
      markerBXValue: 99,
    };
    const onRemoteMarkers = jest.fn();

    renderUseDeltaMarkerSync({ onRemoteMarkers });

    expect(onRemoteMarkers).toHaveBeenCalledTimes(1);
    expect(onRemoteMarkers).toHaveBeenCalledWith(42, 99);
  });

  it("applies a remote marker removal", () => {
    globalDeltaMarkers = {
      sourceId: BasicBuilder.string(),
      markerAXValue: undefined,
      markerBXValue: undefined,
    };
    const onRemoteMarkers = jest.fn();

    renderUseDeltaMarkerSync({
      markerA: { xValue: 7, seriesValues: [] },
      onRemoteMarkers,
    });

    expect(onRemoteMarkers).toHaveBeenCalledWith(undefined, undefined);
  });

  it("does not re-apply remote values that already match the local markers", () => {
    globalDeltaMarkers = {
      sourceId: BasicBuilder.string(),
      markerAXValue: 7,
      markerBXValue: undefined,
    };
    const onRemoteMarkers = jest.fn();

    renderUseDeltaMarkerSync({
      markerA: { xValue: 7, seriesValues: [] },
      onRemoteMarkers,
    });

    expect(onRemoteMarkers).not.toHaveBeenCalled();
  });

  it("releases its claim on the shared slot when disabled while owning it", () => {
    globalDeltaMarkers = { sourceId: subscriberId, markerAXValue: 1, markerBXValue: undefined };
    const { rerender, props } = renderUseDeltaMarkerSync({ enabled: true });
    setGlobalDeltaMarkers.mockClear();

    rerender({ ...props, enabled: false });

    expect(setGlobalDeltaMarkers).toHaveBeenCalledWith(expect.any(Function));
    const updater = setGlobalDeltaMarkers.mock.calls[0][0];
    expect(updater(globalDeltaMarkers)).toBeUndefined();
  });

  it("does not clear another panel's claim on the shared slot when disabled", () => {
    globalDeltaMarkers = {
      sourceId: BasicBuilder.string(),
      markerAXValue: 1,
      markerBXValue: undefined,
    };
    const { rerender, props } = renderUseDeltaMarkerSync({ enabled: true });
    setGlobalDeltaMarkers.mockClear();

    rerender({ ...props, enabled: false });

    const updater = setGlobalDeltaMarkers.mock.calls[0][0];
    expect(updater(globalDeltaMarkers)).toBe(globalDeltaMarkers);
  });

  it("releases its claim on unmount", () => {
    globalDeltaMarkers = { sourceId: subscriberId, markerAXValue: 1, markerBXValue: undefined };
    const { unmount } = renderUseDeltaMarkerSync({ enabled: true });
    setGlobalDeltaMarkers.mockClear();

    unmount();

    expect(setGlobalDeltaMarkers).toHaveBeenCalledWith(expect.any(Function));
    const updater = setGlobalDeltaMarkers.mock.calls[0][0];
    expect(updater(globalDeltaMarkers)).toBeUndefined();
  });
});
