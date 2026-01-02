// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** @jest-environment jsdom */

import { SettingsTreeAction } from "@lichtblick/suite";
import PieChartBuilder from "@lichtblick/suite-base/testing/builders/PieChartBuilder";

import { settingsActionReducer } from "./settingsActionReducer";

describe("settingsActionReducer", () => {
  it("throws an error for unhandled 'perform-node-action'", () => {
    const initialConfig = PieChartBuilder.pieChartConfig();
    const action: SettingsTreeAction = {
      action: "perform-node-action",
      payload: { id: "test-action", path: ["path"] },
    };

    expect(() => settingsActionReducer(initialConfig, action)).toThrow(
      "Unhandled node action: test-action",
    );
  });

  it("updates config correctly for a general-level property", () => {
    const initialConfig = PieChartBuilder.pieChartConfig();
    const action: SettingsTreeAction = {
      action: "update",
      payload: { path: ["general", "path"], input: "string", value: "/new/path" },
    };
    const newConfig = settingsActionReducer(initialConfig, action);

    expect(newConfig.path).toBe("/new/path");
  });
});
