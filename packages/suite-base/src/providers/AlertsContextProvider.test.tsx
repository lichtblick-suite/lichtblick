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
const selectDismissedPlayerAlertKeys = (store: AlertsContextStore) =>
  store.dismissedPlayerAlertKeys;

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

  it("tracks dismissed player alert keys when dismissPlayerAlert is called", () => {
    // Given
    const key = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        dismissedPlayerAlertKeys: useAlertsStore(selectDismissedPlayerAlertKeys),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    expect(result.current.dismissedPlayerAlertKeys.size).toBe(0);

    // When
    act(() => {
      result.current.actions.dismissPlayerAlert(key);
    });

    // Then
    expect(result.current.dismissedPlayerAlertKeys.has(key)).toBe(true);
  });

  it("does not create a new set when dismissing an already dismissed key", () => {
    // Given
    const key = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        dismissedPlayerAlertKeys: useAlertsStore(selectDismissedPlayerAlertKeys),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.dismissPlayerAlert(key);
    });
    const firstRef = result.current.dismissedPlayerAlertKeys;

    // When
    act(() => {
      result.current.actions.dismissPlayerAlert(key);
    });

    // Then
    expect(result.current.dismissedPlayerAlertKeys).toBe(firstRef);
  });

  it("dismisses multiple player alert keys at once", () => {
    // Given
    const keys = [BasicBuilder.string(), BasicBuilder.string()];

    const { result } = renderHook(
      () => ({
        dismissedPlayerAlertKeys: useAlertsStore(selectDismissedPlayerAlertKeys),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    // When
    act(() => {
      result.current.actions.dismissPlayerAlerts(keys);
    });

    // Then
    expect(result.current.dismissedPlayerAlertKeys.size).toBe(2);
    for (const key of keys) {
      expect(result.current.dismissedPlayerAlertKeys.has(key)).toBe(true);
    }
  });

  it("restores dismissed player alerts when restoreDismissedPlayerAlerts is called", () => {
    // Given
    const key = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        dismissedPlayerAlertKeys: useAlertsStore(selectDismissedPlayerAlertKeys),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.dismissPlayerAlert(key);
    });
    expect(result.current.dismissedPlayerAlertKeys.size).toBe(1);

    // When
    act(() => {
      result.current.actions.restoreDismissedPlayerAlerts();
    });

    // Then
    expect(result.current.dismissedPlayerAlertKeys.size).toBe(0);
  });

  it("does not re-add a session alert when setAlert is called after dismiss with same content", () => {
    // Given
    const alert: SessionAlert = { severity: "warn", message: BasicBuilder.string() };
    const tag = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert(tag, alert);
    });
    expect(result.current.alerts).toHaveLength(1);

    act(() => {
      result.current.actions.dismissAlert(tag);
    });
    expect(result.current.alerts).toHaveLength(0);

    // When — same tag + same content
    act(() => {
      result.current.actions.setAlert(tag, alert);
    });

    // Then — stays dismissed
    expect(result.current.alerts).toHaveLength(0);
  });

  it("re-adds a session alert when setAlert is called after dismiss with different content", () => {
    // Given
    const originalAlert: SessionAlert = { severity: "warn", message: BasicBuilder.string() };
    const updatedAlert: SessionAlert = { severity: "error", message: BasicBuilder.string() };
    const tag = BasicBuilder.string();

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert(tag, originalAlert);
    });
    act(() => {
      result.current.actions.dismissAlert(tag);
    });
    expect(result.current.alerts).toHaveLength(0);

    // When
    act(() => {
      result.current.actions.setAlert(tag, updatedAlert);
    });

    // Then
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]).toMatchObject({ tag, ...updatedAlert });
  });
});
