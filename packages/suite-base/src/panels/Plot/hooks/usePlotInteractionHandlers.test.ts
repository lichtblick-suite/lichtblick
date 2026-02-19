/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/* eslint-disable @typescript-eslint/unbound-method */
import { renderHook, act } from "@testing-library/react";

import { debouncePromise } from "@lichtblick/den/async";
import { Time, toSec } from "@lichtblick/rostime";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { TimeBasedChartTooltipData } from "@lichtblick/suite-base/components/TimeBasedChart/TimeBasedChartTooltipContent";
import {
  useSetHoverValue,
  useClearHoverValue,
} from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { DEFAULT_PLOT_CONFIG } from "@lichtblick/suite-base/panels/Plot/constants";
import {
  TooltipStateSetter,
  UsePlotInteractionHandlersProps,
} from "@lichtblick/suite-base/panels/Plot/types";
import { PlotConfig } from "@lichtblick/suite-base/panels/Plot/utils/config";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import usePlotInteractionHandlers from "./usePlotInteractionHandlers";

jest.mock("@lichtblick/den/async", () => ({
  debouncePromise: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/TimelineInteractionStateContext", () => ({
  useSetHoverValue: jest.fn(),
  useClearHoverValue: jest.fn(),
  useTimelineInteractionState: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineGetter: jest.fn(),
}));

describe("usePlotInteractionHandlers", () => {
  const mockCoordinator = {
    addInteractionEvent: jest.fn(),
    getCsvData: jest.fn(),
    getXValueAtPixel: jest.fn(() => BasicBuilder.number()),
    resetBounds: jest.fn(),
    setZoomMode: jest.fn(),
  } as unknown as PlotCoordinator;
  const mockSetActiveTooltip = jest.fn();
  const mockSetHoverValue = jest.fn();
  const mockClearHoverValue = jest.fn();
  const mockSeekPlayback = jest.fn();
  const mockBuildTooltip = jest.fn();

  const setup = ({
    config,
    coordinator = undefined,
    draggingRef,
    renderer,
    setActiveTooltip = jest.fn(),
    shouldSync,
    subscriberId,
  }: Partial<UsePlotInteractionHandlersProps> = {}) => {
    (useSetHoverValue as jest.Mock).mockReturnValue(mockSetHoverValue);
    (useClearHoverValue as jest.Mock).mockReturnValue(mockClearHoverValue);
    (useMessagePipelineGetter as jest.Mock).mockReturnValueOnce(
      jest.fn(() => ({
        seekPlayback: mockSeekPlayback,
        playerState: { activeData: { startTime: RosTimeBuilder.time() } },
      })),
    );

    const props: UsePlotInteractionHandlersProps = {
      config: {
        ...DEFAULT_PLOT_CONFIG,
        ...config,
      },
      coordinator,
      draggingRef: { current: false, ...draggingRef },
      renderer: {
        getElementsAtPixel: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...renderer,
      },
      setActiveTooltip,
      shouldSync: shouldSync ?? false,
      subscriberId: subscriberId ?? BasicBuilder.string(),
    } as unknown as UsePlotInteractionHandlersProps;

    return {
      ...renderHook(() => usePlotInteractionHandlers(props)),
      props,
    };
  };

  const triggerMouseMove = async (
    result: any,
  ): Promise<
    Partial<React.MouseEvent<HTMLElement>> & { expectedCanvasX?: number; expectedCanvasY?: number }
  > => {
    const boundingClientRect = {
      left: BasicBuilder.number(),
      top: BasicBuilder.number(),
    };
    const event: Partial<React.MouseEvent<HTMLElement>> = {
      clientX: BasicBuilder.number(),
      clientY: BasicBuilder.number(),
      currentTarget: {
        getBoundingClientRect: jest.fn(() => ({
          left: boundingClientRect.left,
          top: boundingClientRect.top,
        })),
      } as unknown as EventTarget & HTMLElement,
    };

    const expectedCanvasX = event.clientX! - boundingClientRect.left;
    const expectedCanvasY = event.clientY! - boundingClientRect.top;

    await act(async () => {
      result.current.onMouseMove(event);
    });

    return {
      ...event,
      expectedCanvasX,
      expectedCanvasY,
    };
  };

  const triggerWheel = (
    result: any,
    boundingRect: DOMRect,
  ): Partial<React.WheelEvent<HTMLElement>> => {
    const event: Partial<React.WheelEvent<HTMLElement>> = {
      deltaX: BasicBuilder.number(),
      deltaY: BasicBuilder.number(),
      clientX: BasicBuilder.number(),
      clientY: BasicBuilder.number(),
      currentTarget: {
        getBoundingClientRect: jest.fn(() => boundingRect),
      } as unknown as EventTarget & HTMLElement,
    };

    act(() => {
      result.current.onWheel(event);
    });

    return event;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (debouncePromise as jest.Mock).mockReturnValue(mockBuildTooltip);
  });

  describe("setActiveTooltip", () => {
    it("clears active tooltip if no tooltip items are found", async () => {
      (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
      const { result, props } = setup();
      (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce([]);

      await triggerMouseMove(result);

      expect(props.setActiveTooltip).toHaveBeenCalledWith(undefined);
      expect(props.setActiveTooltip).toHaveBeenCalledTimes(1);
    });

    it("set active tooltip if tooltip items are found with correct data", async () => {
      const elements = [
        PlotBuilder.hoverElement({ data: PlotBuilder.datum({ value: BasicBuilder.number() }) }),
      ];
      (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
      const { result, props } = setup();
      (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce(elements);

      const mouseMoved = await triggerMouseMove(result);

      const expectedResult: TooltipStateSetter = {
        x: mouseMoved.clientX!,
        y: mouseMoved.clientY!,
        data: [
          {
            configIndex: elements[0]!.configIndex,
            value: elements[0]!.data.value,
          } as TimeBasedChartTooltipData,
        ],
      };
      expect(props.setActiveTooltip).toHaveBeenCalledWith(expectedResult);
      expect(props.setActiveTooltip).toHaveBeenCalledTimes(1);
    });

    it("set active tooltip if tooltip items are found when value is a time object", async () => {
      const elements = [
        PlotBuilder.hoverElement({ data: PlotBuilder.datum({ value: RosTimeBuilder.time() }) }),
      ];
      (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
      const { result, props } = setup();
      (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce(elements);

      const mouseMoved = await triggerMouseMove(result);

      const expectedResult: TooltipStateSetter = {
        x: mouseMoved.clientX!,
        y: mouseMoved.clientY!,
        data: [
          { configIndex: elements[0]!.configIndex, value: toSec(elements[0]!.data.value as Time) },
        ],
      };
      expect(props.setActiveTooltip).toHaveBeenCalledWith(expectedResult);
      expect(props.setActiveTooltip).toHaveBeenCalledTimes(1);
    });

    it("set active tooltip if tooltip items are found when value is undefined", async () => {
      const elements = PlotBuilder.hoverElements(1);
      (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
      const { result, props } = setup();
      (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce(elements);

      const mouseMoved = await triggerMouseMove(result);

      const expectedResult: TooltipStateSetter = {
        x: mouseMoved.clientX!,
        y: mouseMoved.clientY!,
        data: [{ configIndex: elements[0]!.configIndex, value: elements[0]!.data.y }],
      };
      expect(props.setActiveTooltip).toHaveBeenCalledWith(expectedResult);
      expect(props.setActiveTooltip).toHaveBeenCalledTimes(1);
    });

    it("set active tooltip if tooltip items are found when having multiple hover elements", async () => {
      const elements = [
        PlotBuilder.hoverElement({ data: PlotBuilder.datum({ value: BasicBuilder.number() }) }),
        PlotBuilder.hoverElement({ data: PlotBuilder.datum({ value: BasicBuilder.number() }) }),
        PlotBuilder.hoverElement({ data: PlotBuilder.datum({ value: BasicBuilder.number() }) }),
      ];
      (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
      const { result, props } = setup();
      (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce(elements);

      const mouseMoved = await triggerMouseMove(result);

      const expectedResult: TooltipStateSetter = {
        x: mouseMoved.clientX!,
        y: mouseMoved.clientY!,
        data: elements.map((element) => ({
          configIndex: element.configIndex,
          value: element.data.value,
        })) as TimeBasedChartTooltipData[],
      };
      expect(props.setActiveTooltip).toHaveBeenCalledWith(expectedResult);
      expect(props.setActiveTooltip).toHaveBeenCalledTimes(1);
    });
  });

  describe("onMouseMove", () => {
    it("sets hover value when xAxisMode is timestamp", async () => {
      const { result, props } = setup({ coordinator: mockCoordinator });

      const mouseMoved = await triggerMouseMove(result);

      expect(result.current.onMouseMove).toBeDefined();
      expect(props.coordinator?.getXValueAtPixel).toHaveBeenCalledWith(mouseMoved.expectedCanvasX);
      expect(mockBuildTooltip).toHaveBeenCalledWith({
        clientX: mouseMoved.clientX,
        clientY: mouseMoved.clientY,
        canvasX: mouseMoved.expectedCanvasX,
        canvasY: mouseMoved.expectedCanvasY,
      });
      expect(mockSetHoverValue).toHaveBeenCalledWith({
        componentId: props.subscriberId,
        value: expect.any(Number),
        type: "PLAYBACK_SECONDS",
      });
    });

    it("sets hover value with type 'other' when xAxisMode is not timestamp", async () => {
      const { result, props } = setup({
        config: { xAxisVal: "other" } as unknown as PlotConfig,
        coordinator: mockCoordinator,
      });

      const mouseMoved = await triggerMouseMove(result);

      expect(result.current.onMouseMove).toBeDefined();
      expect(props.coordinator?.getXValueAtPixel).toHaveBeenCalledWith(mouseMoved.expectedCanvasX);
      expect(mockBuildTooltip).toHaveBeenCalledWith({
        clientX: mouseMoved.clientX,
        clientY: mouseMoved.clientY,
        canvasX: mouseMoved.expectedCanvasX,
        canvasY: mouseMoved.expectedCanvasY,
      });
      expect(mockSetHoverValue).toHaveBeenCalledWith({
        componentId: props.subscriberId,
        value: expect.any(Number),
        type: "OTHER",
      });
    });

    it("should return early when coordinator is not provided", async () => {
      const { result } = setup();

      await triggerMouseMove(result);

      expect(mockCoordinator.getXValueAtPixel).not.toHaveBeenCalled();
      expect(mockSetHoverValue).not.toHaveBeenCalled();
    });

    describe("when using actual debouncePromise", () => {
      it("calls debouncePromise with correct arguments", async () => {
        const { result, props } = setup({ coordinator: mockCoordinator });

        const mouseMoved = await triggerMouseMove(result);

        expect(props.coordinator?.getXValueAtPixel).toHaveBeenCalledWith(
          mouseMoved.expectedCanvasX,
        );
        expect(mockSetHoverValue).toHaveBeenCalledWith({
          componentId: props.subscriberId,
          value: expect.any(Number),
          type: "PLAYBACK_SECONDS",
        });
      });

      it("clears active tooltip if no tooltip items are found", async () => {
        (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
        const { result, props } = setup({ coordinator: mockCoordinator });
        (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce([]);

        await triggerMouseMove(result);

        expect(props.setActiveTooltip).toHaveBeenCalledWith(undefined);
        expect(mockSetHoverValue).toHaveBeenCalled();
      });

      it("does not clear active tooltip if tooltip items are found", async () => {
        const { result, props } = setup({ coordinator: mockCoordinator });
        (props.renderer?.getElementsAtPixel as jest.Mock).mockReturnValueOnce([]);

        await triggerMouseMove(result);

        expect(props.setActiveTooltip).not.toHaveBeenCalledWith(undefined);
        expect(mockSetHoverValue).toHaveBeenCalled();
      });
    });

    it("does not set active tooltip if isMounted is false", async () => {
      (debouncePromise as jest.Mock).mockImplementationOnce((fn) => fn);
      const { result, unmount } = setup();

      unmount();
      await triggerMouseMove(result);

      expect(mockSetActiveTooltip).not.toHaveBeenCalled();
    });
  });

  describe("onMouseOut", () => {
    it("clears hover value", () => {
      const { result, props } = setup();

      act(() => {
        result.current.onMouseOut();
      });

      expect(props.setActiveTooltip).toHaveBeenCalledWith(undefined);
      expect(mockClearHoverValue).toHaveBeenCalledWith(props.subscriberId);
    });

    it("sets mousePresentRef to false", () => {
      const { result, props } = setup();

      act(() => {
        result.current.onMouseOut();
      });

      expect(props.draggingRef.current).toBe(false);
    });
  });

  describe("onWheel", () => {
    it("handles wheel event correctly", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });
      const boundingRect = {
        left: BasicBuilder.number(),
        top: BasicBuilder.number(),
        toJSON: jest.fn().mockReturnValue({
          left: BasicBuilder.number(),
          top: BasicBuilder.number(),
        }),
      } as unknown as DOMRect;

      const wheel = triggerWheel(result, boundingRect);

      expect(props.coordinator?.addInteractionEvent).toHaveBeenCalledWith({
        type: "wheel",
        cancelable: false,
        deltaX: wheel.deltaX,
        deltaY: wheel.deltaY,
        clientX: wheel.clientX,
        clientY: wheel.clientY,
        boundingClientRect: boundingRect.toJSON(),
      });
    });

    it("should onWheel return early when coordinator is not provided", () => {
      const { result } = setup();

      triggerWheel(result, {
        left: BasicBuilder.number(),
        top: BasicBuilder.number(),
      } as DOMRect);

      expect(mockCoordinator.addInteractionEvent).not.toHaveBeenCalled();
    });
  });

  describe("onResetView", () => {
    it("should onResetView return early when coordinator is not provided", () => {
      const { result } = setup();

      act(() => {
        result.current.onResetView();
      });

      expect(mockCoordinator.resetBounds).not.toHaveBeenCalled();
    });

    it("resets coordinator bounds", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });

      act(() => {
        result.current.onResetView();
      });

      expect(props.coordinator?.resetBounds).toHaveBeenCalled();
    });
  });

  describe("key handlers", () => {
    it("sets zoom mode to 'y' on key down 'v'", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });

      act(() => {
        result.current.keyDownHandlers.v();
      });

      expect(props.coordinator?.setZoomMode).toHaveBeenCalledWith("y");
    });

    it("sets zoom mode to 'xy' on key down 'b'", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });

      act(() => {
        result.current.keyDownHandlers.b();
      });

      expect(props.coordinator?.setZoomMode).toHaveBeenCalledWith("xy");
    });

    it("sets zoom mode to 'x' on key up 'v'", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });

      act(() => {
        result.current.keyUphandlers.v();
      });

      expect(props.coordinator?.setZoomMode).toHaveBeenCalledWith("x");
    });

    it("sets zoom mode to 'x' on key up 'b'", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });

      act(() => {
        result.current.keyUphandlers.b();
      });

      expect(props.coordinator?.setZoomMode).toHaveBeenCalledWith("x");
    });
  });

  describe("onClick", () => {
    function buildClickEvent(): React.MouseEvent<HTMLElement> {
      return {
        clientX: BasicBuilder.number(),
        currentTarget: {
          getBoundingClientRect: jest.fn(() => ({ left: BasicBuilder.number() })),
        } as unknown as EventTarget & HTMLElement,
      } as unknown as React.MouseEvent<HTMLElement>;
    }

    it("should return early if draggingRef is true", () => {
      const { result } = setup({ draggingRef: { current: true } });

      act(() => {
        result.current.onClick(buildClickEvent());
      });

      expect(mockSeekPlayback).not.toHaveBeenCalled();
    });

    it("should return early if xAxisMode is not 'timestamp'", () => {
      const { result } = setup({
        config: {
          xAxisVal: "other",
        } as unknown as PlotConfig,
      });

      act(() => {
        result.current.onClick(buildClickEvent());
      });

      expect(mockSeekPlayback).not.toHaveBeenCalled();
    });

    it("should return early if seekPlayback or startTime is undefined", () => {
      (useMessagePipelineGetter as jest.Mock).mockReturnValueOnce({
        seekPlayback: jest.fn(),
        playerState: { activeData: { startTime: RosTimeBuilder.time() } },
      });
      const { result } = setup();

      act(() => {
        result.current.onClick(buildClickEvent());
      });

      expect(mockSeekPlayback).not.toHaveBeenCalled();
    });

    it("should call seekPlayback when seekSeconds greater than 0", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });
      const seekSeconds = BasicBuilder.number();
      (props.coordinator?.getXValueAtPixel as jest.Mock).mockReturnValueOnce(seekSeconds);

      act(() => {
        result.current.onClick(buildClickEvent());
      });

      expect(mockSeekPlayback).toHaveBeenCalledTimes(1);
    });

    it("should not normalize time if seekSeconds is negative", () => {
      const { result, props } = setup({ coordinator: mockCoordinator });
      const seekSeconds = -1;
      (props.coordinator?.getXValueAtPixel as jest.Mock).mockReturnValue(seekSeconds);

      act(() => {
        result.current.onClick(buildClickEvent());
      });

      expect(mockSeekPlayback).not.toHaveBeenCalled();
    });
  });
});
