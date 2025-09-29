/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";

import PanelLogs from "@lichtblick/suite-base/components/PanelLogs";
import { PanelLog } from "@lichtblick/suite-base/components/types";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

function renderPanelLogs(logs: PanelLog[], onClose: () => void = jest.fn()) {
  return render(
    <ThemeProvider isDark={false}>
      <PanelLogs logs={logs} onClose={onClose} />
    </ThemeProvider>,
  );
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
      expect(screen.getByText("Panel Logs (0)")).toBeTruthy();
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
      expect(screen.getByText("Panel Logs (2)")).toBeTruthy();
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
      expect(screen.getByText("Panel Logs (1)")).toBeTruthy();
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
      expect(screen.getByText("Panel Logs (3)")).toBeTruthy();
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
      expect(screen.getByText("Panel Logs (20)")).toBeTruthy();
      // Check that the container has overflow styling
      const logContainer = container.querySelector(".MuiList-root")?.parentElement;
      expect(logContainer).toBeTruthy();
      const computedStyle = getComputedStyle(logContainer!);
      expect(computedStyle.maxHeight).toBe("200px");
      expect(computedStyle.overflowY).toBe("auto");
    });
  });
});
