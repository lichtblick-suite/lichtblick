/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { toSec } from "@lichtblick/rostime";
import type { OffscreenCanvasRenderer } from "@lichtblick/suite-base/panels/Plot/OffscreenCanvasRenderer";
import { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import useDeltaMarkerSync from "@lichtblick/suite-base/panels/shared/useDeltaMarkerSync";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import useDeltaMeasureMode, {
  UseDeltaMeasureModeProps,
} from "./useDeltaMeasureMode";

jest.mock("@lichtblick/suite-base/panels/shared/useDeltaMarkerSync");

describe("useDeltaMeasureMode", () => {
  function buildClickEvent(
    overrides: Partial<{ left: number; top: number }> = {},
  ): React.MouseEvent<HTMLElement> {
    return {
      clientX: BasicBuilder.number(),
      clientY: BasicBuilder.number(),
      currentTarget: {
        getBoundingClientRect: jest.fn(() => ({
          left: overrides.left ?? 0,
          top: overrides.top ?? 0,
        })),
      } as unknown as EventTarget & HTMLElement,
    } as unknown as React.MouseEvent<HTMLElement>;
  }

  // OffscreenCanvasRenderer has private fields, so a plain mock object can only structurally
  // satisfy a type picked from its public members - not Partial<OffscreenCanvasRenderer> itself.
  type MockRenderer = Partial<
    Pick<OffscreenCanvasRenderer, "getElementsAtPixel">
  >;

  type SetupOverrides = Omit<Partial<UseDeltaMeasureModeProps>, "renderer"> & {
    renderer?: MockRenderer;
  };

  beforeEach(() => {
    (useDeltaMarkerSync as jest.Mock).mockReturnValue(undefined);
  });

  const setup = ({
    coordinator,
    renderer,
    draggingRef,
    resetKey,
    subscriberId,
    syncEnabled,
  }: SetupOverrides = {}) => {
    const props: UseDeltaMeasureModeProps = {
      coordinator,
      renderer: {
        getElementsAtPixel: jest.fn().mockResolvedValue([]),
        ...renderer,
      } as unknown as OffscreenCanvasRenderer,
      draggingRef: { current: false, ...draggingRef },
      resetKey,
      subscriberId: subscriberId ?? BasicBuilder.string(),
      syncEnabled: syncEnabled ?? false,
    };

    return {
      ...renderHook(
        (hookProps: UseDeltaMeasureModeProps) => useDeltaMeasureMode(hookProps),
        {
          initialProps: props,
        },
      ),
      props,
    };
  };

  const mockCoordinator = {
    getXValueAtPixel: jest.fn(() => BasicBuilder.number()),
    getPixelForXValue: jest.fn(() => BasicBuilder.number()),
  } as unknown as PlotCoordinator;

  it("should start inactive with no markers", () => {
    // Given / When
    const { result } = setup();

    // Then
    expect(result.current.active).toBe(false);
    expect(result.current.markerA).toBeUndefined();
    expect(result.current.markerB).toBeUndefined();
  });

  it("should toggle active on and off", () => {
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
      result.current.toggleActive();
    });

    // Then
    expect(result.current.active).toBe(false);
  });

  it("should clear both markers when toggled", async () => {
    // Given
    const { result } = setup({ coordinator: mockCoordinator });
    act(() => {
      result.current.toggleActive();
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    expect(result.current.markerA).toBeDefined();

    // When
    act(() => {
      result.current.toggleActive();
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
  });

  it("should not place a marker when inactive", async () => {
    // Given
    const { result } = setup({ coordinator: mockCoordinator });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
  });

  it("should not place a marker while dragging", async () => {
    // Given
    const { result } = setup({
      coordinator: mockCoordinator,
      draggingRef: { current: true },
    });
    act(() => {
      result.current.toggleActive();
    });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
  });

  it("should not place a marker without a coordinator", async () => {
    // Given
    const { result } = setup({ coordinator: undefined });
    act(() => {
      result.current.toggleActive();
    });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA).toBeUndefined();
  });

  it("should place marker A on the first click with the resolved x value and series values", async () => {
    // Given
    const xValue = BasicBuilder.number();
    const configIndex = BasicBuilder.number();
    const value = BasicBuilder.number();
    (mockCoordinator.getXValueAtPixel as jest.Mock).mockReturnValueOnce(xValue);
    const elements = [
      PlotBuilder.hoverElement({
        configIndex,
        data: PlotBuilder.datum({ value }),
      }),
    ];
    const { result } = setup({
      coordinator: mockCoordinator,
      renderer: { getElementsAtPixel: jest.fn().mockResolvedValue(elements) },
    });
    act(() => {
      result.current.toggleActive();
    });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA).toEqual({
      xValue,
      seriesValues: [{ configIndex, value }],
    });
    expect(result.current.markerB).toBeUndefined();
  });

  it("should place marker B on the second click, keeping marker A", async () => {
    // Given
    const { result } = setup({ coordinator: mockCoordinator });
    act(() => {
      result.current.toggleActive();
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    const markerA = result.current.markerA;

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA).toEqual(markerA);
    expect(result.current.markerB).toBeDefined();
  });

  it("should reset to a fresh marker A on the third click", async () => {
    // Given
    (mockCoordinator.getXValueAtPixel as jest.Mock)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2)
      .mockReturnValueOnce(3);
    const { result } = setup({ coordinator: mockCoordinator });
    act(() => {
      result.current.toggleActive();
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    const markerAFromFirstRound = result.current.markerA;

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerB).toBeUndefined();
    expect(result.current.markerA).toBeDefined();
    expect(result.current.markerA).not.toEqual(markerAFromFirstRound);
  });

  it("should keep only the closest value per series when duplicated", async () => {
    // Given
    const configIndex = BasicBuilder.number();
    const elements = [
      PlotBuilder.hoverElement({
        configIndex,
        data: PlotBuilder.datum({ value: 1 }),
      }),
      PlotBuilder.hoverElement({
        configIndex,
        data: PlotBuilder.datum({ value: 2 }),
      }),
    ];
    const { result } = setup({
      coordinator: mockCoordinator,
      renderer: { getElementsAtPixel: jest.fn().mockResolvedValue(elements) },
    });
    act(() => {
      result.current.toggleActive();
    });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA?.seriesValues).toEqual([
      { configIndex, value: 1 },
    ]);
  });

  it("should convert a Time value to seconds", async () => {
    // Given
    const configIndex = BasicBuilder.number();
    const time = RosTimeBuilder.time();
    const elements = [
      PlotBuilder.hoverElement({
        configIndex,
        data: PlotBuilder.datum({ value: time }),
      }),
    ];
    const { result } = setup({
      coordinator: mockCoordinator,
      renderer: { getElementsAtPixel: jest.fn().mockResolvedValue(elements) },
    });
    act(() => {
      result.current.toggleActive();
    });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA?.seriesValues[0]?.value).toEqual(toSec(time));
  });

  it("should fall back to the datum's y value when value is undefined", async () => {
    // Given
    const configIndex = BasicBuilder.number();
    const elements = [
      PlotBuilder.hoverElement({
        configIndex,
        data: PlotBuilder.datum({ value: undefined }),
      }),
    ];
    const { result } = setup({
      coordinator: mockCoordinator,
      renderer: { getElementsAtPixel: jest.fn().mockResolvedValue(elements) },
    });
    act(() => {
      result.current.toggleActive();
    });

    // When
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });

    // Then
    expect(result.current.markerA?.seriesValues[0]?.value).toEqual(
      elements[0]!.data.y,
    );
  });

  it("should remove marker A and marker B independently", async () => {
    // Given
    const { result } = setup({ coordinator: mockCoordinator });
    act(() => {
      result.current.toggleActive();
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
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

  it("should clear markers but keep the mode active when resetKey changes", async () => {
    // Given
    const { result, rerender, props } = setup({
      coordinator: mockCoordinator,
      resetKey: "a",
    });
    act(() => {
      result.current.toggleActive();
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    expect(result.current.markerA).toBeDefined();

    // When
    rerender({ ...props, resetKey: "b" });

    // Then
    expect(result.current.active).toBe(true);
    expect(result.current.markerA).toBeUndefined();
  });

  it("should keep markers when resetKey stays the same across rerenders", async () => {
    // Given
    const { result, rerender, props } = setup({
      coordinator: mockCoordinator,
      resetKey: "a",
    });
    act(() => {
      result.current.toggleActive();
    });
    await act(async () => {
      result.current.handleCanvasClick(buildClickEvent());
    });
    expect(result.current.markerA).toBeDefined();

    // When
    rerender({ ...props, resetKey: "a" });

    // Then
    expect(result.current.markerA).toBeDefined();
  });

  describe("remote marker sync", () => {
    function getOnRemoteMarkers(): (
      markerAXValue: number | undefined,
      markerBXValue: number | undefined,
    ) => void {
      const call = (useDeltaMarkerSync as jest.Mock).mock.calls.at(-1)[0];
      return (markerAXValue, markerBXValue) => {
        call.onRemoteMarkers(markerAXValue, markerBXValue);
      };
    }

    it("passes subscriberId through, gating enabled on active", () => {
      // Given / When
      const subscriberId = BasicBuilder.string();
      setup({ coordinator: mockCoordinator, subscriberId, syncEnabled: true });

      // Then
      expect(useDeltaMarkerSync).toHaveBeenCalledWith(
        expect.objectContaining({ subscriberId, enabled: false }),
      );
    });

    it("enables sync only once the mode is active", () => {
      // Given
      const { result } = setup({ coordinator: mockCoordinator, syncEnabled: true });

      // When
      act(() => {
        result.current.toggleActive();
      });

      // Then
      expect(useDeltaMarkerSync).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    });

    it("places marker A from a remote x value, resolved via getPixelForXValue", async () => {
      // Given
      const xValue = BasicBuilder.number();
      const configIndex = BasicBuilder.number();
      const value = BasicBuilder.number();
      (mockCoordinator.getPixelForXValue as jest.Mock).mockReturnValueOnce(42);
      const getElementsAtPixel = jest
        .fn()
        .mockResolvedValue([
          PlotBuilder.hoverElement({ configIndex, data: PlotBuilder.datum({ value }) }),
        ]);
      const { result } = setup({
        coordinator: mockCoordinator,
        renderer: { getElementsAtPixel },
        syncEnabled: true,
      });

      // When
      await act(async () => {
        getOnRemoteMarkers()(xValue, undefined);
      });

      // Then
      expect(getElementsAtPixel).toHaveBeenCalledWith({ x: 42, y: 0 });
      expect(result.current.markerA).toEqual({
        xValue,
        seriesValues: [{ configIndex, value }],
      });
    });

    it("removes marker B when the remote value is cleared", async () => {
      // Given
      const { result } = setup({ coordinator: mockCoordinator, syncEnabled: true });
      act(() => {
        result.current.toggleActive();
      });
      await act(async () => {
        result.current.handleCanvasClick(buildClickEvent());
      });
      await act(async () => {
        result.current.handleCanvasClick(buildClickEvent());
      });
      const markerA = result.current.markerA;
      expect(result.current.markerB).toBeDefined();

      // When
      await act(async () => {
        getOnRemoteMarkers()(markerA?.xValue, undefined);
      });

      // Then
      expect(result.current.markerB).toBeUndefined();
    });

    it("commits a remote reset (new A, cleared B) atomically instead of a stale intermediate A", async () => {
      // Given: locally both markers are set (mirrors the follower panel already showing P1/P2).
      const { result } = setup({ coordinator: mockCoordinator, syncEnabled: true });
      act(() => {
        result.current.toggleActive();
      });
      await act(async () => {
        result.current.handleCanvasClick(buildClickEvent());
      });
      await act(async () => {
        result.current.handleCanvasClick(buildClickEvent());
      });
      const staleMarkerA = result.current.markerA;
      expect(result.current.markerB).toBeDefined();

      // When: a combined remote update arrives - a new A and a cleared B in the same call, like
      // a wraparound reset broadcasts it. Marker A resolution is async (Worker round-trip) while
      // marker B is a plain removal - both must land in the same committed state.
      const freshXValue = BasicBuilder.number();
      await act(async () => {
        getOnRemoteMarkers()(freshXValue, undefined);
      });

      // Then: marker A reflects the fresh value directly and marker B stays cleared - never a
      // transient render with the old marker A and no marker B.
      expect(result.current.markerA).toEqual({ xValue: freshXValue, seriesValues: [] });
      expect(result.current.markerA).not.toEqual(staleMarkerA);
      expect(result.current.markerB).toBeUndefined();
    });
  });
});
