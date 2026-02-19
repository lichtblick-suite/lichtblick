/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";

import { useMessagePipelineSubscribe } from "@lichtblick/suite-base/components/MessagePipeline";
import { useHoverValue } from "@lichtblick/suite-base/context/TimelineInteractionStateContext";

import { VerticalBars } from "./VerticalBars";
import "@testing-library/jest-dom";

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipelineSubscribe: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/TimelineInteractionStateContext", () => ({
  useHoverValue: jest.fn(),
}));

describe("VerticalBars", () => {
  let mockSubscribe: jest.Mock;
  let mockCoordinator: any;

  const setup = (props = {}) => {
    const defaultProps = {
      hoverComponentId: "test",
      xAxisIsPlaybackTime: true,
      coordinator: undefined,
    };
    const mergedProps = { ...defaultProps, ...props };
    return render(<VerticalBars {...mergedProps} />);
  };

  beforeEach(() => {
    mockSubscribe = jest.fn((callback) => {
      callback({ playerState: { activeData: undefined } });
      return jest.fn();
    });
    (useMessagePipelineSubscribe as jest.Mock).mockImplementation(() => mockSubscribe);

    mockCoordinator = {
      on: jest.fn(),
      off: jest.fn(),
      renderer: jest.fn(),
    };

    jest.clearAllMocks();
  });

  it("renders null without coordinator", () => {
    setup({ coordinator: undefined });
    expect(screen.queryByTestId("vertical-bars")).toBeDefined();
  });

  it("updates bar positions on xScale changes", () => {
    const { unmount } = setup({ coordinator: mockCoordinator });

    expect(mockCoordinator.on).toHaveBeenCalledWith("xScaleChanged", expect.any(Function));

    unmount();
    expect(mockCoordinator.off).toHaveBeenCalledWith("xScaleChanged", expect.any(Function));
  });

  it("renders bars correctly if a proper coordinator is defined", () => {
    (useHoverValue as jest.Mock).mockReturnValue({ value: 5 });

    setup({ coordinator: mockCoordinator });

    const currentTimeBar = screen.getByTestId("vertical-bar");
    const hoverBar = screen.getByTestId("hover-bar");

    expect(currentTimeBar).toBeInTheDocument();
    expect(hoverBar).toBeInTheDocument();
  });

  it("handles unsubscriptions on unmount", () => {
    const { unmount } = setup({ coordinator: mockCoordinator });

    unmount();

    expect(mockCoordinator.off).toHaveBeenCalledWith("xScaleChanged", expect.any(Function));
  });

  it("handles undefined activeData correctly", () => {
    const latestCurrentTimeSinceStart = { current: undefined };

    setup({ coordinator: mockCoordinator });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
    expect(latestCurrentTimeSinceStart.current).toBeUndefined();
  });

  it("does not subscribe to messagePipeline when xAxisIsPlaybackTime is false", () => {
    setup({ coordinator: mockCoordinator, xAxisIsPlaybackTime: false });
    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});
