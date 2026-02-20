/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { PropsWithChildren } from "react";

import { AlertsContextStore, useAlertsActions, useAlertsStore } from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";

import AlertsContextProvider from "./AlertsContextProvider";

const selectAlerts = (store: AlertsContextStore) => store.alerts;

describe("AlertsContextProvider", () => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <AlertsContextProvider>{children}</AlertsContextProvider>
  );

  it("does not update alerts when setAlert is called with the same tag and identical alert", () => {
    const alert: PlayerAlert = { severity: "warn", message: "Repeated converter alert" };

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert("converter:foo:id-1", alert);
    });

    const firstAlertsRef = result.current.alerts;
    expect(firstAlertsRef).toHaveLength(1);

    act(() => {
      result.current.actions.setAlert("converter:foo:id-1", alert);
    });

    expect(result.current.alerts).toBe(firstAlertsRef);
    expect(result.current.alerts).toHaveLength(1);
  });

  it("updates alerts when setAlert is called with the same tag but different alert payload", () => {
    const originalAlert: PlayerAlert = { severity: "warn", message: "Old message" };
    const updatedAlert: PlayerAlert = { severity: "error", message: "New message" };

    const { result } = renderHook(
      () => ({
        alerts: useAlertsStore(selectAlerts),
        actions: useAlertsActions(),
      }),
      { wrapper },
    );

    act(() => {
      result.current.actions.setAlert("converter:foo:id-1", originalAlert);
    });

    const firstAlertsRef = result.current.alerts;

    act(() => {
      result.current.actions.setAlert("converter:foo:id-1", updatedAlert);
    });

    expect(result.current.alerts).not.toBe(firstAlertsRef);
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]).toMatchObject({ tag: "converter:foo:id-1", ...updatedAlert });
  });
});
