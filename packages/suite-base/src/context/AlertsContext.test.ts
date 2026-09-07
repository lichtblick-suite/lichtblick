// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { getAlertKey } from "./AlertsContext";

describe("getAlertKey", () => {
  it("should return the same key for identical severity, message, tip and error", () => {
    // Given
    const alertA = {
      severity: "warn" as const,
      message: "Same message",
      tip: "Same tip",
      error: new Error("Same error"),
    };
    const alertB = {
      severity: "warn" as const,
      message: "Same message",
      tip: "Same tip",
      error: new Error("Same error"),
    };

    // When / Then
    expect(getAlertKey(alertA)).toBe(getAlertKey(alertB));
  });

  it("should return different keys when only the tip differs", () => {
    // Given
    const alertA = { severity: "warn" as const, message: "Same message", tip: "Tip A" };
    const alertB = { severity: "warn" as const, message: "Same message", tip: "Tip B" };

    // When / Then
    expect(getAlertKey(alertA)).not.toBe(getAlertKey(alertB));
  });

  it("should return different keys when only the error message differs", () => {
    // Given
    const alertA = {
      severity: "error" as const,
      message: "Same message",
      error: new Error("Error A"),
    };
    const alertB = {
      severity: "error" as const,
      message: "Same message",
      error: new Error("Error B"),
    };

    // When / Then
    expect(getAlertKey(alertA)).not.toBe(getAlertKey(alertB));
  });

  it("should return different keys when the message differs", () => {
    // Given
    const alertA = { severity: "info" as const, message: "Message A" };
    const alertB = { severity: "info" as const, message: "Message B" };

    // When / Then
    expect(getAlertKey(alertA)).not.toBe(getAlertKey(alertB));
  });

  it("should return different keys when the severity differs", () => {
    // Given
    const alertA = { severity: "error" as const, message: "Same message" };
    const alertB = { severity: "warn" as const, message: "Same message" };

    // When / Then
    expect(getAlertKey(alertA)).not.toBe(getAlertKey(alertB));
  });

  it("should treat undefined tip/error the same as an alert without those fields", () => {
    // Given
    const alertA = { severity: "info" as const, message: "Same message" };
    const alertB = {
      severity: "info" as const,
      message: "Same message",
      tip: undefined,
      error: undefined,
    };

    // When / Then
    expect(getAlertKey(alertA)).toBe(getAlertKey(alertB));
  });
});
