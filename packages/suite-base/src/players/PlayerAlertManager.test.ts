// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PlayerAlertManager from "@lichtblick/suite-base/players/PlayerAlertManager";

describe("PlayerAlertManager", () => {
  it("keys alerts by id", () => {
    const manager = new PlayerAlertManager();
    expect(manager.alerts()).toEqual([]);
    manager.addAlert("a", { severity: "error", message: "A" });
    expect(manager.alerts()).toEqual([{ severity: "error", message: "A" }]);
    manager.addAlert("b", { severity: "error", message: "B" });
    manager.addAlert("a", { severity: "warn", message: "A2" });
    expect(manager.alerts()).toEqual([
      { severity: "warn", message: "A2" },
      { severity: "error", message: "B" },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(2);
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  it("allows removing alerts by id", () => {
    const manager = new PlayerAlertManager();
    manager.addAlert("a", { severity: "warn", message: "A" });
    manager.addAlert("b", { severity: "warn", message: "B" });
    manager.addAlert("c", { severity: "error", message: "C" });
    expect(manager.removeAlert("b")).toBe(true);
    expect(manager.alerts()).toEqual([
      { severity: "warn", message: "A" },
      { severity: "error", message: "C" },
    ]);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  it("allows removing alerts with a predicate", () => {
    const manager = new PlayerAlertManager();
    manager.addAlert("a", { severity: "warn", message: "A" });
    manager.addAlert("b", { severity: "warn", message: "B" });
    manager.addAlert("c", { severity: "error", message: "C" });
    manager.addAlert("d", { severity: "error", message: "D" });
    expect(manager.removeAlerts((id, alert) => id === "c" || alert.severity === "warn")).toBe(true);
    expect(manager.alerts()).toEqual([{ severity: "error", message: "D" }]);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(2);
    (console.warn as jest.Mock).mockClear();
    (console.error as jest.Mock).mockClear();
  });

  it("keeps array identity until alerts change", () => {
    const manager = new PlayerAlertManager();

    let result = manager.alerts();
    expect(result).toEqual([]);
    expect(manager.alerts()).toBe(result);

    manager.addAlert("a", { severity: "error", message: "A" });
    manager.addAlert("b", { severity: "error", message: "B" });
    result = manager.alerts();
    expect(result).toEqual([
      { severity: "error", message: "A" },
      { severity: "error", message: "B" },
    ]);
    expect(manager.alerts()).toBe(result);

    // key is not present - no change
    expect(manager.removeAlert("c")).toBe(false);
    expect(manager.alerts()).toBe(result);

    // predicate does not match any alerts - no change
    expect(manager.removeAlerts(() => false)).toBe(false);
    expect(manager.alerts()).toBe(result);

    // remove by id
    expect(manager.removeAlert("a")).toBe(true);
    result = manager.alerts();
    expect(result).toEqual([{ severity: "error", message: "B" }]);
    expect(manager.alerts()).toBe(result);

    // remove by predicate
    expect(manager.removeAlerts((id) => id === "b")).toBe(true);
    result = manager.alerts();
    expect(result).toEqual([]);
    expect(manager.alerts()).toBe(result);
    expect(console.error).toHaveBeenCalledTimes(2);
    (console.error as jest.Mock).mockClear();
  });
});
