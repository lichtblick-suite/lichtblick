/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { userEvent } from "@storybook/testing-library";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";

import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { useAppTimeFormat } from "@lichtblick/suite-base/hooks";
import { NormalizedLogMessage } from "@lichtblick/suite-base/panels/Log/types";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import LogList from "./LogList";

function createMockLogMessage(
  index: number,
  level: number,
  message?: string,
): NormalizedLogMessage {
  return {
    stamp: { sec: 1000 + index, nsec: 0 },
    level,
    message: message ?? `Test log message ${index}`,
  };
}

// Mock the hooks
jest.mock("@lichtblick/suite-base/hooks", () => ({
  useAppTimeFormat: jest.fn(),
}));

// Mock AutoSizer to avoid layout issues in tests
jest.mock("react-virtualized-auto-sizer", () => {
  return ({
    children,
  }: {
    children: (props: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 800, height: 600 });
});

// Mock react-resize-detector
jest.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({
    width: 800,
    height: 600,
    ref: jest.fn(),
  }),
}));

describe("LogList Component", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (useAppTimeFormat as jest.Mock).mockReturnValue({
      timeFormat: "SEC",
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    cleanup();
  });

  function setup(items: NormalizedLogMessage[] = []) {
    const props = {
      items,
    };

    const ui: React.ReactElement = (
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <LogList {...props} />
        </MockPanelContextProvider>
      </ThemeProvider>
    );

    return {
      ...render(ui),
      props,
      user: userEvent.setup(),
    };
  }

  it("should render the component correctly", () => {
    // Given / When
    setup();
    const virtualizedList = screen.getByTestId("virtualized-list");
    // Then
    expect(virtualizedList).toBeInTheDocument();
  });

  it("should handle empty items array", () => {
    // Given / When
    setup([]);
    const virtualizedList = screen.getByTestId("virtualized-list");
    // Then
    expect(virtualizedList).toBeInTheDocument();
  });

  it("should not display scroll-to-bottom button initially", () => {
    // Given / When
    setup();
    const scrollButton = screen.queryByTestId("scroll-to-bottom-button");
    // Then
    expect(scrollButton).not.toBeInTheDocument();
  });

  it("should display different log levels", () => {
    // Given / When
    // Create mock data with different log levels
    const mockItems: NormalizedLogMessage[] = [
      createMockLogMessage(0, 1, "Debug message"), // Debug level
      createMockLogMessage(1, 2, "Info message"), // Info level
      createMockLogMessage(2, 3, "Warning message"), // Warn level
      createMockLogMessage(3, 4, "Error message"), // Error level
      createMockLogMessage(4, 1, "Another debug"), // Another debug
    ];

    setup(mockItems);

    // Check that the virtualized list is rendered
    const virtualizedList = screen.getByTestId("virtualized-list");
    expect(virtualizedList).toBeInTheDocument();

    // Then
    // Verify log messages are displayed
    expect(virtualizedList.textContent).toContain("Debug message");
    expect(virtualizedList.textContent).toContain("Info message");
    expect(virtualizedList.textContent).toContain("Warning message");
    expect(virtualizedList.textContent).toContain("Error message");
    expect(virtualizedList.textContent).toContain("Another debug");

    // Verify log levels are displayed
    expect(virtualizedList.textContent).toContain("DEBUG");
    expect(virtualizedList.textContent).toContain("INFO");
    expect(virtualizedList.textContent).toContain("WARN");
    expect(virtualizedList.textContent).toContain("ERROR");
  });
});
