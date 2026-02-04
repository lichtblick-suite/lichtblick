/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/unbound-method */

import { renderHook } from "@testing-library/react";

import { useTimelineInteractionState } from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { PlotCoordinator } from "@lichtblick/suite-base/panels/Plot/PlotCoordinator";
import { BasicBuilder } from "@lichtblick/test-builders";

import useGlobalSync from "./useGlobalSync";

jest.mock("@lichtblick/suite-base/context/TimelineInteractionStateContext");

describe("useGlobalSync", () => {
  let coordinator: PlotCoordinator | undefined;
  let setCanReset: jest.Mock;
  let setGlobalBounds: jest.Mock;
  let globalBounds: any;
  const renderUseGlobalSync = (options: { shouldSync: boolean }, subscriberId: string) => {
    return renderHook(() => {
      useGlobalSync(coordinator, setCanReset, options, subscriberId);
    });
  };
  const subscriberId = BasicBuilder.string();

  beforeEach(() => {
    coordinator = {
      setGlobalBounds: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    } as unknown as PlotCoordinator;

    setCanReset = jest.fn();
    setGlobalBounds = jest.fn();
    globalBounds = {};

    (useTimelineInteractionState as jest.Mock).mockImplementation((selector) => {
      if (selector.name === "selectGlobalBounds") {
        return globalBounds;
      }
      if (selector.name === "selectSetGlobalBounds") {
        return setGlobalBounds;
      }
    });

    jest.clearAllMocks();
  });

  it("should set global bounds on coordinator if shouldSync is true and sourceId is different", () => {
    renderUseGlobalSync({ shouldSync: true }, subscriberId);

    expect(coordinator!.setGlobalBounds).toHaveBeenCalledWith(globalBounds);
  });

  it("should not set global bounds on coordinator if shouldSync is false", () => {
    renderUseGlobalSync({ shouldSync: false }, subscriberId);

    expect(coordinator!.setGlobalBounds).not.toHaveBeenCalled();
  });

  it("should not set global bounds on coordinator if sourceId is the same", () => {
    globalBounds.sourceId = subscriberId;
    renderUseGlobalSync({ shouldSync: true }, subscriberId);

    expect(coordinator!.setGlobalBounds).not.toHaveBeenCalled();
  });

  it("should add and remove event listeners on coordinator", () => {
    const { unmount } = renderUseGlobalSync({ shouldSync: true }, subscriberId);

    expect(coordinator!.on).toHaveBeenCalledWith("timeseriesBounds", expect.any(Function));
    expect(coordinator!.on).toHaveBeenCalledWith("viewportChange", setCanReset);

    unmount();

    expect(coordinator!.off).toHaveBeenCalledWith("timeseriesBounds", expect.any(Function));
    expect(coordinator!.off).toHaveBeenCalledWith("viewportChange", setCanReset);
  });

  it("should call setGlobalBounds on timeseriesBounds event", () => {
    const newBounds = { min: 10, max: 90 };

    renderUseGlobalSync({ shouldSync: true }, subscriberId);
    const timeseriesBoundsHandler = (coordinator!.on as jest.Mock).mock.calls.find(
      ([event]) => event === "timeseriesBounds",
    )[1];

    timeseriesBoundsHandler(newBounds);

    expect(setGlobalBounds).toHaveBeenCalledWith({
      min: newBounds.min,
      max: newBounds.max,
      sourceId: subscriberId,
      userInteraction: true,
    });
  });

  it("should not call setGlobalBounds when coordinator is undefined", () => {
    coordinator = undefined;

    renderUseGlobalSync({ shouldSync: true }, subscriberId);

    expect(setGlobalBounds).not.toHaveBeenCalled();
  });
});
