/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { getAlertKey, useAlertsStore } from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import useAlertCount from "./useAlertCount";

jest.mock("@lichtblick/suite-base/components/MessagePipeline");
jest.mock("@lichtblick/suite-base/context/AlertsContext");

describe("useAlertCount", () => {
  const mockUseMessagePipeline = useMessagePipeline as jest.Mock;
  const mockUseAlertsStore = useAlertsStore as jest.Mock;
  const mockGetPlayerAlertKey = getAlertKey as jest.Mock;

  function setupAlertsStore(
    alerts: unknown[],
    dismissedPlayerAlertKeys: ReadonlySet<string> = new Set(),
  ): void {
    mockUseAlertsStore.mockImplementation((selector: (store: unknown) => unknown) =>
      selector({ alerts, dismissedPlayerAlertKeys }),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPlayerAlertKey.mockImplementation(
      (alert: PlayerAlert) => `${alert.severity}::${alert.message}`,
    );
  });

  it("should return empty alerts when no player or session alerts exist", () => {
    // Given
    mockUseMessagePipeline.mockReturnValue([]);
    setupAlertsStore([]);

    // When
    const { result } = renderHook(() => useAlertCount());

    // Then
    expect(result.current.playerAlerts).toEqual([]);
    expect(result.current.sessionAlerts).toEqual([]);
    expect(result.current.alertCount).toBe(0);
  });

  it("should return player alerts", () => {
    // Given
    const playerAlert1: PlayerAlert = {
      message: BasicBuilder.string(),
      severity: "warn",
    };
    const playerAlert2: PlayerAlert = {
      message: BasicBuilder.string(),
      severity: "error",
    };
    const playerAlerts = [playerAlert1, playerAlert2];

    mockUseMessagePipeline.mockReturnValue(playerAlerts);
    setupAlertsStore([]);

    // When
    const { result } = renderHook(() => useAlertCount());

    // Then
    expect(result.current.playerAlerts).toEqual(playerAlerts);
    expect(result.current.alertCount).toBe(2);
  });

  it("should return session alerts", () => {
    // Given
    const sessionAlert1 = {
      message: BasicBuilder.string(),
      severity: "info" as const,
    };
    const sessionAlert2 = {
      message: BasicBuilder.string(),
      severity: "warn" as const,
    };
    const sessionAlerts = [sessionAlert1, sessionAlert2];

    mockUseMessagePipeline.mockReturnValue([]);
    setupAlertsStore(sessionAlerts);

    // When
    const { result } = renderHook(() => useAlertCount());

    // Then
    expect(result.current.sessionAlerts).toEqual(sessionAlerts);
    expect(result.current.alertCount).toBe(2);
  });

  it("should combine player and session alerts in alert count", () => {
    // Given
    const playerAlert: PlayerAlert = {
      message: BasicBuilder.string(),
      severity: "error",
    };
    const sessionAlert = {
      message: BasicBuilder.string(),
      severity: "warn" as const,
    };

    mockUseMessagePipeline.mockReturnValue([playerAlert]);
    setupAlertsStore([sessionAlert]);

    // When
    const { result } = renderHook(() => useAlertCount());

    // Then
    expect(result.current.playerAlerts).toEqual([playerAlert]);
    expect(result.current.sessionAlerts).toEqual([sessionAlert]);
    expect(result.current.alertCount).toBe(2);
  });

  it("should exclude dismissed player alerts from the list and count", () => {
    // Given
    const dismissedAlert: PlayerAlert = {
      message: BasicBuilder.string(),
      severity: "error",
    };
    const visibleAlert: PlayerAlert = {
      message: BasicBuilder.string(),
      severity: "warn",
    };
    const sessionAlert = {
      message: BasicBuilder.string(),
      severity: "info" as const,
    };

    mockUseMessagePipeline.mockReturnValue([dismissedAlert, visibleAlert]);
    setupAlertsStore(
      [sessionAlert],
      new Set([`${dismissedAlert.severity}::${dismissedAlert.message}`]),
    );

    // When
    const { result } = renderHook(() => useAlertCount());

    // Then
    expect(result.current.playerAlerts).toEqual([visibleAlert]);
    expect(result.current.alertCount).toBe(2);
  });

  it("should handle undefined player alerts gracefully", () => {
    // Given
    mockUseMessagePipeline.mockReturnValue(undefined);
    setupAlertsStore([]);

    // When
    const { result } = renderHook(() => useAlertCount());

    // Then
    expect(result.current.playerAlerts).toEqual([]);
    expect(result.current.alertCount).toBe(0);
  });
});
