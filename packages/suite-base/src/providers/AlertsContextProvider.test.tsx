/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import {
  AlertsContextStore,
  SessionAlert,
  useAlertsActions,
  useAlertsStore,
} from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import AlertsContextProvider from "./AlertsContextProvider";

const selectAlerts = (store: AlertsContextStore) => store.alerts;

describe("AlertsContextProvider", () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <AlertsContextProvider>{children}</AlertsContextProvider>
  );

  it("updates alerts when setAlert is called with a new tag", () => {
    const alert: PlayerAlert = { severity: "warn", message: "New alarm" };
    const alertTag = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    expect(result.current.alerts).toHaveLength(0);

    act(() => {
      result.current.actions.setAlert(alertTag, alert);
    });

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]).toMatchObject({ tag: alertTag, ...alert });
  });

  it("does not update alerts when setAlert is called with the same tag and identical alert", () => {
    const alert: PlayerAlert = { severity: "warn", message: "Repeated converter alert" };
    const alertTag = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert(alertTag, alert);
    });

    const firstAlertsRef = result.current.alerts;
    expect(firstAlertsRef).toHaveLength(1);

    act(() => {
      result.current.actions.setAlert(alertTag, alert);
    });

    expect(result.current.alerts).toBe(firstAlertsRef);
    expect(result.current.alerts).toHaveLength(1);
  });

  it("updates alerts when setAlert is called with the same tag but different alert payload", () => {
    const originalAlert: PlayerAlert = { severity: "warn", message: "Old message" };
    const updatedAlert: PlayerAlert = { severity: "error", message: "New message" };
    const alertTag = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert(alertTag, originalAlert);
    });

    const firstAlertsRef = result.current.alerts;

    act(() => {
      result.current.actions.setAlert(alertTag, updatedAlert);
    });

    expect(result.current.alerts).not.toBe(firstAlertsRef);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]).toMatchObject({ tag: alertTag, ...updatedAlert });
  });

  it("clears all alerts when clearAlerts is called", () => {
    // Given
    const firstAlert: SessionAlert = { severity: "warn", message: "first" };
    const secondAlert: SessionAlert = { severity: "error", message: "second" };
    const firstTag = BasicBuilder.string();
    const secondTag = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert(firstTag, firstAlert);
      result.current.actions.setAlert(secondTag, secondAlert);
    });

    expect(result.current.alerts).toHaveLength(2);

    // When
    act(() => {
      result.current.actions.clearAlerts();
    });

    // Then
    expect(result.current.alerts).toHaveLength(0);
  });
});
