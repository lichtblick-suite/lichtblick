// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ListAlert } from "./AlertsList";
import { getAlertCopyText } from "./utils";

describe("getAlertCopyText", () => {
  const baseAlert: ListAlert = {
    key: "player:error::base",
    severity: "error",
    message: "Something failed",
  };

  it("returns severity and message as a single line when no tip or error", () => {
    // Given
    const alert = { ...baseAlert };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toBe(`[${alert.severity}] ${alert.message}`);
  });

  it("includes the tip separated by a blank line", () => {
    // Given
    const alert = { ...baseAlert, tip: "Check your network settings" };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toBe(`[${alert.severity}] ${alert.message}\n\n${alert.tip}`);
  });

  it("includes the error stack when error is an Error instance", () => {
    // Given
    const error = new Error("Connection refused");
    error.stack = "Error: Connection refused\n    at connect (file.ts:10)";
    const alert = { ...baseAlert, error };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toContain(`[${alert.severity}] ${alert.message}`);
    expect(result).toContain(error.stack);
  });

  it("includes the error message when Error has no stack", () => {
    // Given
    const error = new Error("No stack");
    error.stack = undefined;
    const alert = { ...baseAlert, error };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toBe(`[${alert.severity}] ${alert.message}\n\n${error.message}`);
  });

  it("includes string error details", () => {
    // Given
    const alert = { ...baseAlert, error: "Extra details here" };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toBe(`[${alert.severity}] ${alert.message}\n\n${alert.error}`);
  });

  it("does not include empty string error or tip", () => {
    // Given
    const alert = { ...baseAlert, tip: "", error: "" };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toBe(`[${alert.severity}] ${alert.message}`);
  });

  it("includes both tip and error when both are present", () => {
    // Given
    const alert = { ...baseAlert, tip: "Restart the app", error: "Detailed error info" };

    // When
    const result = getAlertCopyText(alert);

    // Then
    expect(result).toBe(`[${alert.severity}] ${alert.message}\n\n${alert.tip}\n\n${alert.error}`);
  });
});
