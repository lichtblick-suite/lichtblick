/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import PanelLogs from "@lichtblick/suite-base/components/PanelLogs";
import { PanelLog } from "@lichtblick/suite-base/components/types";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

function renderPanelLogs(
  logs: PanelLog[],
  onClose: () => void = jest.fn(),
  onClear: () => void = jest.fn(),
) {
  return render(<PanelLogs logs={logs} onClose={onClose} onClear={onClear} />);
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
      expect(screen.getByText("No logs yet.")).toBeInTheDocument();
      expect(screen.getByText("Errors and log messages will appear here.")).toBeInTheDocument();
      expect(getLogCountText(0)).toBeInTheDocument();
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
      const infoMessage = BasicBuilder.string();
      const anotherInforMessage = BasicBuilder.string();
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: infoMessage,
        },
        {
          timestamp: "2023-12-01 10:01:00",
          message: anotherInforMessage,
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(getLogCountText(2)).toBeInTheDocument();
      expect(screen.getByText(`[INFO] ${infoMessage}`)).toBeInTheDocument();
      expect(screen.getByText(`[INFO] ${anotherInforMessage}`)).toBeInTheDocument();
      expect(screen.getByText("2023-12-01 10:00:00")).toBeInTheDocument();
      expect(screen.getByText("2023-12-01 10:01:00")).toBeInTheDocument();
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
      expect(getLogCountText(1)).toBeInTheDocument();
      expect(screen.getByText("[ERROR] Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("2023-12-01 10:00:00")).toBeInTheDocument();

      // Check for error stack - it's rendered in a pre element
      const errorStack = screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === "pre" &&
          content.includes("Error: Test error") &&
          content.includes("at test.js:1:1")
        );
      });
      expect(errorStack).toBeInTheDocument();
    });

    it("When error has no stack Then displays error message only", () => {
      const errorMessage = BasicBuilder.string();
      // Given
      const error = new Error(errorMessage);
      delete error.stack;
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: errorMessage,
          error,
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(screen.getByText(`[ERROR] ${errorMessage}`)).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe("Given mixed log types", () => {
    it("When rendered Then displays all logs in order", () => {
      const errorMessage = BasicBuilder.string();
      const infoMessage = BasicBuilder.string();
      const anotherInfoMessage = BasicBuilder.string();
      // Given
      const error = new Error(errorMessage);
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: infoMessage,
        },
        {
          timestamp: "2023-12-01 10:01:00",
          message: errorMessage,
          error,
        },
        {
          timestamp: "2023-12-01 10:02:00",
          message: anotherInfoMessage,
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      expect(getLogCountText(3)).toBeInTheDocument();
      expect(screen.getByText(`[INFO] ${infoMessage}`)).toBeInTheDocument();
      expect(screen.getByText(`[ERROR] ${errorMessage}`)).toBeInTheDocument();
      expect(screen.getByText(`[INFO] ${anotherInfoMessage}`)).toBeInTheDocument();

      // Then
      expect(screen.getByText("2023-12-01 10:00:00")).toBeInTheDocument();
      expect(screen.getByText("2023-12-01 10:01:00")).toBeInTheDocument();
      expect(screen.getByText("2023-12-01 10:02:00")).toBeInTheDocument();
    });
  });

  describe("Given many logs", () => {
    it("When rendered Then container is scrollable", () => {
      const logMessage = BasicBuilder.string();
      const logsLength = 20;
      // Given
      const logs: PanelLog[] = Array.from({ length: logsLength }, (_, i) => ({
        timestamp: `2023-12-01 10:${i.toString().padStart(2, "0")}:00`,
        message: `${logMessage} ${i + 1}`,
      }));

      // When
      const { container } = renderPanelLogs(logs);

      // Then
      expect(getLogCountText(logsLength)).toBeInTheDocument();

      // Then
      const listContainer = container.querySelector('[class*="listContainer"]');
      expect(listContainer).toBeInTheDocument();
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
      expect(resizeHandle).toBeInTheDocument();
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
      expect(container).toBeInTheDocument();
      expect(container?.getAttribute("style")).toContain("height: 300px");
    });

    it("When resize handle is dragged Then updates panel height", () => {
      // Given
      const logs: PanelLog[] = [];

      render(
        <ThemeProvider isDark={false}>
          <PanelLogs logs={logs} onClose={jest.fn()} onClear={jest.fn()} initialHeight={400} />
        </ThemeProvider>,
      );

      const resizeHandle = screen.getByTitle("Drag to resize panel logs");
      const container = document.querySelector('[class*="root"]');

      // When
      fireEvent.mouseDown(resizeHandle, { clientY: 100 });

      fireEvent(document, new MouseEvent("mousemove", { clientY: 50 }));
      fireEvent(document, new MouseEvent("mouseup"));

      // Then
      expect(container?.getAttribute("style")).toContain("height: 450px");
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

    it("When onHeightChange is provided and drag ends Then calls onHeightChange with new height", () => {
      // Given
      const logs: PanelLog[] = [];
      const onHeightChange = jest.fn();
      const initialHeight = 400;

      render(
        <ThemeProvider isDark={false}>
          <PanelLogs
            logs={logs}
            onClose={jest.fn()}
            onClear={jest.fn()}
            initialHeight={initialHeight}
            onHeightChange={onHeightChange}
          />
        </ThemeProvider>,
      );

      const resizeHandle = screen.getByTitle("Drag to resize panel logs");

      // When
      fireEvent.mouseDown(resizeHandle, { clientY: 100 });
      fireEvent(document, new MouseEvent("mousemove", { clientY: 50 }));
      fireEvent(document, new MouseEvent("mouseup"));

      // Then
      expect(onHeightChange).toHaveBeenCalledWith(450); // 400 + (100 - 50)
    });

    it("When onHeightChange is not provided and drag ends Then does not cause errors", () => {
      // Given
      const logs: PanelLog[] = [];

      render(
        <ThemeProvider isDark={false}>
          <PanelLogs logs={logs} onClose={jest.fn()} onClear={jest.fn()} initialHeight={400} />
        </ThemeProvider>,
      );

      const resizeHandle = screen.getByTitle("Drag to resize panel logs");

      // When/Then - should not throw error
      expect(() => {
        fireEvent.mouseDown(resizeHandle, { clientY: 100 });
        fireEvent(document, new MouseEvent("mousemove", { clientY: 50 }));
        fireEvent(document, new MouseEvent("mouseup"));
      }).not.toThrow();
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
      const logMessage = BasicBuilder.string();
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: logMessage,
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
      const logMessage = BasicBuilder.string();
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: logMessage,
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
      const logMessage = BasicBuilder.string();
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: logMessage,
        },
      ];

      // When
      renderPanelLogs(logs);

      // Then
      const clearButton = screen.getByRole("button", { name: "Clear logs" });
      const icon = clearButton.querySelector('[data-testid="DeleteSweepIcon"]');
      expect(icon).toBeInTheDocument();
    });

    it("When rendered Then clear button appears before close button", () => {
      const logMessage = BasicBuilder.string();
      // Given
      const logs: PanelLog[] = [
        {
          timestamp: "2023-12-01 10:00:00",
          message: logMessage,
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
