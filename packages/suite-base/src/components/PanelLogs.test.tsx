/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";

import PanelLogs from "@lichtblick/suite-base/components/PanelLogs";
import { PanelLog } from "@lichtblick/suite-base/components/types";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

function renderPanelLogs(
  logs: PanelLog[],
  onClose: () => void = jest.fn(),
  onClear: () => void = jest.fn(),
) {
  return render(
    <ThemeProvider isDark={false}>
      <PanelLogs logs={logs} onClose={onClose} onClear={onClear} />
    </ThemeProvider>,
  );
}

function getLogCountText(count: number) {
  return screen.getByText((_content, element) => {
    return (
      element?.textContent === `Logs (${count})` &&
      element.className.includes("MuiTypography-subtitle2")
    );
  });
}

describe("PanelLogs", () => {
  beforeEach(() => {
    // jsdom can't parse our @container CSS so we have to silence console.error for this test.
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe("Given no logs", () => {
    it("When rendered Then displays empty state message", () => {
      // Given
      const logs: PanelLog[] = [];

      // When
      renderPanelLogs(logs);

      // Then
      expect(screen.getByText("No logs yet.")).toBeTruthy();
      expect(screen.getByText("Errors and log messages will appear here.")).toBeTruthy();
      expect(getLogCountText(0)).toBeTruthy();
    });

    it("When close button is clicked Then onClose is called", () => {
      // Given
      const logs: PanelLog[] = [];
      const onClose = jest.fn();

      // When
      renderPanelLogs(logs, onClose);
      const closeButton = screen.getByRole("button", { name: "Close logs" });
      fireEvent.click(closeButton);

      // Then
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Given info logs", () => {
    it("When rendered Then displays log messages correctly", () => {
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Test info message",
        },
        {
          timestamp: "2023-12-01 10:01:00",
          message: "Another info message",
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(getLogCountText(2)).toBeTruthy();
      expect(screen.getByText("[INFO] Test info message")).toBeTruthy();
      expect(screen.getByText("[INFO] Another info message")).toBeTruthy();
      expect(screen.getByText("2023-12-01 10:00:00")).toBeTruthy();
      expect(screen.getByText("2023-12-01 10:01:00")).toBeTruthy();
    });
  });

  describe("Given error logs", () => {
    it("When rendered Then displays error logs with ERROR prefix", () => {
      // Given
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Something went wrong",
          error,
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(getLogCountText(1)).toBeTruthy();
      expect(screen.getByText("[ERROR] Something went wrong")).toBeTruthy();
      expect(screen.getByText("2023-12-01 10:00:00")).toBeTruthy();

      // Check for error stack - it's rendered in a pre element
      const errorStack = screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === "pre" &&
          content.includes("Error: Test error") &&
          content.includes("at test.js:1:1")
        );
      });
      expect(errorStack).toBeTruthy();
    });

    it("When error has no stack Then displays error message only", () => {
      // Given
      const error = new Error("Test error without stack");
      delete error.stack;
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Error occurred",
          error,
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(screen.getByText("[ERROR] Error occurred")).toBeTruthy();
      expect(screen.getByText("Test error without stack")).toBeTruthy();
    });
  });

  describe("Given mixed log types", () => {
    it("When rendered Then displays all logs in order", () => {
      // Given
      const error = new Error("Critical error");
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Info message",
        },
        {
          timestamp: "2023-12-01 10:01:00",
          message: "Error occurred",
          error,
        },
        {
          timestamp: "2023-12-01 10:02:00",
          message: "Another info message",
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(getLogCountText(3)).toBeTruthy();
      expect(screen.getByText("[INFO] Info message")).toBeTruthy();
      expect(screen.getByText("[ERROR] Error occurred")).toBeTruthy();
      expect(screen.getByText("[INFO] Another info message")).toBeTruthy();

      // Verify timestamps are displayed
      expect(screen.getByText("2023-12-01 10:00:00")).toBeTruthy();
      expect(screen.getByText("2023-12-01 10:01:00")).toBeTruthy();
      expect(screen.getByText("2023-12-01 10:02:00")).toBeTruthy();
    });
  });

  describe("Given many logs", () => {
    it("When rendered Then container is scrollable", () => {
      // Given
      const logs: PanelLog[] = Array.from({ length: 20 }, (_, i) => ({
        timestamp: `2023-12-01 10:${i.toString().padStart(2, "0")}:00`,
        message: `Log message ${i + 1}`,
      }));

      // When
      const { container } = renderPanelLogs(logs);

      // Then
      expect(getLogCountText(20)).toBeTruthy();
      // Check that the list container has overflow styling for scrolling
      const listContainer = container.querySelector('[class*="listContainer"]');
      expect(listContainer).toBeTruthy();
      const computedStyle = getComputedStyle(listContainer!);
      expect(computedStyle.overflowY).toBe("auto");
    });
  });

  describe("Given resizable functionality", () => {
    it("When rendered Then displays resize handle", () => {
      // Given
      const logs: PanelLog[] = [];

      // When
      renderPanelLogs(logs);

      // Then
      const resizeHandle = screen.getByTitle("Drag to resize panel logs");
      expect(resizeHandle).toBeTruthy();
    });

    it("When rendered with initialHeight Then uses provided height", () => {
      // Given
      const logs: PanelLog[] = [];
      const initialHeight = 300;

      // When
      render(
        <ThemeProvider isDark={false}>
          <PanelLogs
            logs={logs}
            onClose={jest.fn()}
            initialHeight={initialHeight}
            onClear={jest.fn()}
          />
        </ThemeProvider>,
      );

      // Then
      const container = document.querySelector('[class*="root"]');
      expect(container).toBeTruthy();
      expect(container?.getAttribute("style")).toContain("height: 300px");
    });

    it("When resize handle is dragged Then updates panel height", () => {
      // Given
      const logs: PanelLog[] = [];
      renderPanelLogs(logs);

      const resizeHandle = screen.getByTitle("Drag to resize panel logs");
      const container = document.querySelector('[class*="root"]');

      // When - simulate mouse down, move, and up
      fireEvent.mouseDown(resizeHandle, { clientY: 100 });

      // Simulate mouse move upward (should increase height)
      fireEvent(document, new MouseEvent("mousemove", { clientY: 50 }));
      fireEvent(document, new MouseEvent("mouseup"));

      // Then
      expect(container?.getAttribute("style")).toContain("height: 250px"); // 200 + (100-50) = 250
    });

    it("When dragging beyond max height Then constrains to maximum", () => {
      // Given
      const logs: PanelLog[] = [];
      renderPanelLogs(logs);

      const resizeHandle = screen.getByTitle("Drag to resize panel logs");
      const container = document.querySelector('[class*="root"]');

      // When - simulate dragging way up (beyond max height)
      fireEvent.mouseDown(resizeHandle, { clientY: 100 });
      fireEvent(document, new MouseEvent("mousemove", { clientY: -1000 })); // Very large upward movement
      fireEvent(document, new MouseEvent("mouseup"));

      // Then - should be constrained to max height (600px)
      expect(container?.getAttribute("style")).toContain("height: 600px");
    });

    it("When dragging below min height Then constrains to minimum", () => {
      // Given
      const logs: PanelLog[] = [];
      renderPanelLogs(logs);

      const resizeHandle = screen.getByTitle("Drag to resize panel logs");
      const container = document.querySelector('[class*="root"]');

      // When - simulate dragging way down (below min height)
      fireEvent.mouseDown(resizeHandle, { clientY: 100 });
      fireEvent(document, new MouseEvent("mousemove", { clientY: 1000 })); // Very large downward movement
      fireEvent(document, new MouseEvent("mouseup"));

      // Then - should be constrained to min height (120px)
      expect(container?.getAttribute("style")).toContain("height: 120px");
    });
  });

  describe("Given clear logs functionality", () => {
    it("When no logs Then clear button is disabled", () => {
      // Given
      const logs: PanelLog[] = [];

      // When
      renderPanelLogs(logs);

      // Then
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      expect(clearButton.hasAttribute("disabled")).toBe(true);
    });

    it("When logs exist Then clear button is enabled", () => {
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Test log",
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      expect(clearButton.hasAttribute("disabled")).toBe(false);
    });

    it("When clear button is clicked Then onClear is called", () => {
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Test log",
        },
      ];
      const onClear = jest.fn();

      // When
      renderPanelLogs(logs, jest.fn(), onClear);
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      fireEvent.click(clearButton);

      // Then
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it("When clear button is clicked multiple times Then onClear is called each time", () => {
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Test log",
        },
      ];
      const onClear = jest.fn();

      // When
      renderPanelLogs(logs, jest.fn(), onClear);
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      fireEvent.click(clearButton);
      fireEvent.click(clearButton);
      fireEvent.click(clearButton);

      // Then
      expect(onClear).toHaveBeenCalledTimes(3);
    });

    it("When rendered Then clear button has correct icon", () => {
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Test log",
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      const icon = clearButton.querySelector('[data-testid="DeleteSweepIcon"]');
      expect(icon).toBeTruthy();
    });

    it("When rendered Then clear button appears before close button", () => {
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: "Test log",
        },
      ];

      // When
      const { container } = renderPanelLogs(logs);

      // Then
      const buttons = container.querySelectorAll('button[title*="logs"]');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]?.getAttribute("title")).toBe("Clear logs");
      expect(buttons[1]?.getAttribute("title")).toBe("Close logs");
    });
  });
});
