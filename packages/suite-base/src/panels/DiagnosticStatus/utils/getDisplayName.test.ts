// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { DISPLAY_EMPTY_STATE } from "@lichtblick/suite-base/panels/DiagnosticStatus/constants";
import { getDisplayName } from "@lichtblick/suite-base/panels/DiagnosticStatus/utils/getDisplayName";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("getDisplayName", () => {
  it("handles hardware_id and name", () => {
    const hardwareId = BasicBuilder.string();
    const name = BasicBuilder.string();

    const result = getDisplayName(hardwareId, name);

    expect(result).toBe(`${hardwareId}: ${name}`);
  });

  it("handles blank name with hardware_id", () => {
    const hardwareId = BasicBuilder.string();
    const name = "";

    const result = getDisplayName(hardwareId, name);

    expect(result).toBe(hardwareId);
  });

  it("handles blank hardware_id with name", () => {
    const hardwareId = "";
    const name = BasicBuilder.string();

    const result = getDisplayName(hardwareId, name);

    expect(result).toBe(name);
  });

  it("handles blank hardware_id and blank name", () => {
    const hardwareId = "";
    const name = "";

    const result = getDisplayName(hardwareId, name);

    expect(result).toBe(DISPLAY_EMPTY_STATE);
  });
});
