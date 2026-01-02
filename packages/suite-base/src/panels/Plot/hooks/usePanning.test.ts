/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { renderHook } from "@testing-library/react";
import Hammer from "hammerjs";
import { act } from "react";

import { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { BasicBuilder } from "@lichtblick/test-builders";

import usePanning from "./usePanning";

const mockHammerManager = {
  add: jest.fn(),
  on: jest.fn(),
  destroy: jest.fn(),
};

jest.mock("hammerjs");
Hammer.Manager = jest.fn().mockImplementation(() => mockHammerManager);

type UsePanningProps = {
  canvasDiv?: HTMLDivElement | ReactNull;
  coodinator?: PlotCoordinator | undefined;
};

describe("usePanning", () => {
  const eventType = {
    panEnd: "panend",
    panMove: "panmove",
    panStart: "panstart",
  };

  const triggerEvent = (hammerEventType: string, mockEvent: any) => {
    const handler = mockHammerManager.on.mock.calls.find(([event]) => event === hammerEventType)[1];
    act(() => {
      handler(mockEvent);
    });
  };

  const setup = (override: UsePanningProps = {}) => {
    const canvasWidth = "800";
    const canvasHeight = "600";

    let canvasDiv: HTMLDivElement | ReactNull = ReactNull;
    if (!Object.hasOwn(override, "canvasDiv")) {
      canvasDiv = document.createElement("div");
      canvasDiv.style.position = "relative";
      canvasDiv.style.width = `${canvasWidth}px`;
      canvasDiv.style.height = `${canvasHeight}px`;
      document.body.appendChild(canvasDiv);
    }

    let coordinator: PlotCoordinator | undefined = undefined;
    let addInteractionEventSpy: jest.SpyInstance | undefined = undefined;
    if (!Object.hasOwn(override, "coodinator")) {
      coordinator = {
        addInteractionEvent: jest.fn(),
      } as unknown as PlotCoordinator;
      addInteractionEventSpy = jest.spyOn(coordinator, "addInteractionEvent");
    }

    const draggingRef: React.MutableRefObject<boolean> = { current: false };

    const event: any = {
      deltaX: BasicBuilder.number(),
      deltaY: BasicBuilder.number(),
      target: {
        getBoundingClientRect: jest.fn().mockReturnValue({
          toJSON: () => ({ x: 0, y: 0, width: `${canvasWidth}px`, height: `${canvasHeight}px` }),
        }),
      },
    };

    return {
      ...renderHook(() => {
        usePanning(canvasDiv, coordinator, draggingRef);
      }),
      addInteractionEventSpy,
      canvasDiv,
      coordinator,
      draggingRef,
      event,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize Hammer Manager and set up event listeners", () => {
    const { canvasDiv } = setup();

    expect(Hammer.Manager).toHaveBeenCalledWith(canvasDiv);
    expect(mockHammerManager.add).toHaveBeenCalledWith(expect.any(Hammer.Pan));
    expect(mockHammerManager.on).toHaveBeenCalledWith(eventType.panStart, expect.any(Function));
    expect(mockHammerManager.on).toHaveBeenCalledWith(eventType.panMove, expect.any(Function));
    expect(mockHammerManager.on).toHaveBeenCalledWith(eventType.panEnd, expect.any(Function));
  });

  it("should call coordinator.addInteractionEvent on panstart", () => {
    const { event, canvasDiv, addInteractionEventSpy, draggingRef } = setup();
    event.deltaX = BasicBuilder.number();
    event.deltaY = BasicBuilder.number();
    event.center = { x: BasicBuilder.number(), y: BasicBuilder.number() };

    triggerEvent(eventType.panStart, event);

    expect(draggingRef.current).toBe(true);
    expect(addInteractionEventSpy).toHaveBeenCalledWith({
      type: eventType.panStart,
      cancelable: false,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      center: event.center,
      boundingClientRect: {
        x: 0,
        y: 0,
        width: canvasDiv!.style.width,
        height: canvasDiv!.style.height,
      },
    });
  });

  it("should call coordinator.addInteractionEvent on panmove", () => {
    const { canvasDiv, event, addInteractionEventSpy } = setup();

    triggerEvent(eventType.panMove, event);

    expect(addInteractionEventSpy).toHaveBeenCalledWith({
      type: eventType.panMove,
      cancelable: false,
      deltaY: event.deltaY,
      deltaX: event.deltaX,
      boundingClientRect: {
        x: 0,
        y: 0,
        width: canvasDiv!.style.width,
        height: canvasDiv!.style.height,
      },
    });
  });

  it("should call coordinator.addInteractionEvent on panend and reset draggingRef", () => {
    const { canvasDiv, event, addInteractionEventSpy, draggingRef } = setup();

    triggerEvent(eventType.panEnd, event);

    expect(addInteractionEventSpy).toHaveBeenCalledWith({
      type: eventType.panEnd,
      cancelable: false,
      deltaY: event.deltaY,
      deltaX: event.deltaX,
      boundingClientRect: {
        x: 0,
        y: 0,
        width: canvasDiv!.style.width,
        height: canvasDiv!.style.height,
      },
    });

    jest.useFakeTimers();
    expect(draggingRef.current).toBe(false);
  });

  it("should clean up Hammer Manager on unmount", () => {
    const { unmount } = setup();

    unmount();

    expect(mockHammerManager.destroy).toHaveBeenCalled();
  });

  it("should do nothing if canvasDiv is not provided", () => {
    const { result, addInteractionEventSpy } = setup({ canvasDiv: undefined });

    expect(result.current).toBeUndefined();
    expect(Hammer.Manager).not.toHaveBeenCalled();
    expect(addInteractionEventSpy).not.toHaveBeenCalled();
  });

  it("should do nothing if coordinator is not provided", () => {
    const { result } = setup({ coodinator: undefined });

    expect(result.current).toBeUndefined();
    expect(Hammer.Manager).not.toHaveBeenCalled();
  });
});
