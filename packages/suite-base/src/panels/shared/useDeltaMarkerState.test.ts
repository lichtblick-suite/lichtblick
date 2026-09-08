/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { BasicBuilder } from "@lichtblick/test-builders";

import { DeltaMarker } from "./deltaMarkers";
import useDeltaMarkerState, {
  UseDeltaMarkerStateProps,
} from "./useDeltaMarkerState";

describe("useDeltaMarkerState", () => {
  function buildMarker(overrides: Partial<DeltaMarker> = {}): DeltaMarker {
    return {
      xValue: BasicBuilder.number(),
      seriesValues: [],
      ...overrides,
    };
  }

  const setup = (resetKey?: string) => {
    const props: UseDeltaMarkerStateProps = { resetKey };
    return {
      ...renderHook(
        (hookProps: UseDeltaMarkerStateProps) => useDeltaMarkerState(hookProps),
        { initialProps: props },
      ),
      props,
    };
  };

  it("should start inactive with no markers", () => {
    // Given / When
    const { result } = setup();

    // Then
    expect(result.current.active).toBe(false);
    expect(result.current.markerA).toBeUndefined();
    expect(result.current.markerB).toBeUndefined();
  });

  it("should toggle active on and off, clearing markers", () => {
    // Given
    const { result } = setup();

    // When
    act(() => {
      result.current.toggleActive();
    });

    // Then
    expect(result.current.active).toBe(true);

    // When
    act(() => {
      const slot = result.current.nextMarkerSlot();
      result.current.setMarker(slot, buildMarker());
    });
    act(() => {
      result.current.toggleActive();
    });

    // Then
    expect(result.current.active).toBe(false);
    expect(result.current.markerA).toBeUndefined();
  });

  it("should place the first marker in slot A", () => {
    // Given
    const { result } = setup();
    const marker = buildMarker();

    // When
    act(() => {
      const slot = result.current.nextMarkerSlot();
      result.current.setMarker(slot, marker);
    });

    // Then
    expect(result.current.markerA).toEqual(marker);
    expect(result.current.markerB).toBeUndefined();
  });

  it("should place the second marker in slot B, keeping marker A", () => {
    // Given
    const { result } = setup();
    const markerA = buildMarker();
    const markerB = buildMarker();
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), markerA);
    });

    // When
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), markerB);
    });

    // Then
    expect(result.current.markerA).toEqual(markerA);
    expect(result.current.markerB).toEqual(markerB);
  });

  it("should reset to a fresh marker A on the third slot request", () => {
    // Given
    const { result } = setup();
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    const freshMarker = buildMarker();

    // When
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), freshMarker);
    });

    // Then
    expect(result.current.markerB).toBeUndefined();
    expect(result.current.markerA).toEqual(freshMarker);
  });

  it("should remove marker A and marker B independently", () => {
    // Given
    const { result } = setup();
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });

    // When
    act(() => {
      result.current.removeMarkerA();
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
    expect(result.current.markerB).toBeDefined();

    // When
    act(() => {
      result.current.removeMarkerB();
    });

    // Then
    expect(result.current.markerB).toBeUndefined();
  });

  it("should clear a stale marker B once a new marker A is placed", () => {
    // Given: both markers set, then marker A removed (leaving a stale marker B)
    const { result } = setup();
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    act(() => {
      result.current.removeMarkerA();
    });

    // When
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });

    // Then
    expect(result.current.markerA).toBeDefined();
    expect(result.current.markerB).toBeUndefined();
  });

  it("should clear markers but keep the mode active when resetKey changes", () => {
    // Given
    const { result, rerender, props } = setup("a");
    act(() => {
      result.current.toggleActive();
    });
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    expect(result.current.markerA).toBeDefined();

    // When
    rerender({ ...props, resetKey: "b" });

    // Then
    expect(result.current.active).toBe(true);
    expect(result.current.markerA).toBeUndefined();
  });

  it("should keep markers when resetKey stays the same across rerenders", () => {
    // Given
    const { result, rerender, props } = setup("a");
    act(() => {
      result.current.setMarker(result.current.nextMarkerSlot(), buildMarker());
    });
    expect(result.current.markerA).toBeDefined();

    // When
    rerender({ ...props, resetKey: "a" });

    // Then
    expect(result.current.markerA).toBeDefined();
  });
});
