// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PlayerAlert } from "@lichtblick/suite-base/players/types";

import { ListAlert } from "./AlertsList";
import { buildGroupedAlerts, getAlertCopyText } from "./utils";

type SessionAlertInput = PlayerAlert & { tag: string };

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

describe("buildGroupedAlerts", () => {
  it("should return empty array when there are no alerts", () => {
    // Given / When
    const result = buildGroupedAlerts([], [], new Set());

    // Then
    expect(result).toEqual([]);
  });

  it("should return ungrouped session alerts with count 1", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "tag-1", severity: "warn", message: "Alert A" },
      { tag: "tag-2", severity: "info", message: "Alert B" },
    ];

    // When
    const result = buildGroupedAlerts(sessionAlerts, [], new Set());

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]!.count).toBe(1);
    expect(result[1]!.count).toBe(1);
  });

  it("should group session alerts with identical severity and message", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "panel-A:err", severity: "error", message: "Decode failed" },
      { tag: "panel-B:err", severity: "error", message: "Decode failed" },
      { tag: "panel-C:err", severity: "error", message: "Decode failed" },
    ];

    // When
    const result = buildGroupedAlerts(sessionAlerts, [], new Set());

    // Then
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(3);
    expect(result[0]!.tags).toEqual(["panel-A:err", "panel-B:err", "panel-C:err"]);
  });

  it("should not group alerts with different messages", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "tag-1", severity: "error", message: "Error A" },
      { tag: "tag-2", severity: "error", message: "Error B" },
    ];

    // When
    const result = buildGroupedAlerts(sessionAlerts, [], new Set());

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]!.count).toBe(1);
    expect(result[1]!.count).toBe(1);
  });

  it("should not group alerts with same message but different severity", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "tag-1", severity: "error", message: "Same message" },
      { tag: "tag-2", severity: "warn", message: "Same message" },
    ];

    // When
    const result = buildGroupedAlerts(sessionAlerts, [], new Set());

    // Then
    expect(result).toHaveLength(2);
  });

  it("should not group alerts with same severity and message but different tips", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "tag-1", severity: "warn", message: "Same message", tip: "Tip A" },
      { tag: "tag-2", severity: "warn", message: "Same message", tip: "Tip B" },
    ];

    // When
    const result = buildGroupedAlerts(sessionAlerts, [], new Set());

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]!.count).toBe(1);
    expect(result[1]!.count).toBe(1);
  });

  it("should not group alerts with same severity and message but different errors", () => {
    // Given
    const playerAlerts: PlayerAlert[] = [
      { severity: "error", message: "Same message", error: new Error("Error A") },
      { severity: "error", message: "Same message", error: new Error("Error B") },
    ];

    // When
    const result = buildGroupedAlerts([], playerAlerts, new Set());

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]!.count).toBe(1);
    expect(result[1]!.count).toBe(1);
  });

  it("should exclude dismissed player alerts", () => {
    // Given
    const playerAlerts: PlayerAlert[] = [
      { severity: "error", message: "Connection lost" },
      { severity: "warn", message: "Clock skew" },
    ];
    const dismissed = new Set(["error::Connection lost::::"]);

    // When
    const result = buildGroupedAlerts([], playerAlerts, dismissed);

    // Then
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toBe("Clock skew");
  });

  it("should sort by severity: errors first, then warnings, then info", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "tag-1", severity: "info", message: "Info alert" },
      { tag: "tag-2", severity: "error", message: "Error alert" },
      { tag: "tag-3", severity: "warn", message: "Warn alert" },
    ];

    // When
    const result = buildGroupedAlerts(sessionAlerts, [], new Set());

    // Then
    expect(result.map((a) => a.severity)).toEqual(["error", "warn", "info"]);
  });

  it("should group mixed session and player alerts with same content", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "panel-A:err", severity: "error", message: "Decode failed" },
    ];
    const playerAlerts: PlayerAlert[] = [{ severity: "error", message: "Decode failed" }];

    // When
    const result = buildGroupedAlerts(sessionAlerts, playerAlerts, new Set());

    // Then
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(2);
    expect(result[0]!.tags).toEqual(["panel-A:err"]);
    expect(result[0]!.playerAlertKeys).toEqual(["error::Decode failed::::"]);
  });

  it("should collect all tags and playerAlertKeys for batch dismiss", () => {
    // Given
    const sessionAlerts: SessionAlertInput[] = [
      { tag: "panel-A:warn", severity: "warn", message: "Frame missing" },
      { tag: "panel-B:warn", severity: "warn", message: "Frame missing" },
    ];
    const playerAlerts: PlayerAlert[] = [{ severity: "warn", message: "Frame missing" }];

    // When
    const result = buildGroupedAlerts(sessionAlerts, playerAlerts, new Set());

    // Then
    expect(result).toHaveLength(1);
    expect(result[0]!.count).toBe(3);
    expect(result[0]!.tags).toEqual(["panel-A:warn", "panel-B:warn"]);
    expect(result[0]!.playerAlertKeys).toEqual(["warn::Frame missing::::"]);
  });
});
