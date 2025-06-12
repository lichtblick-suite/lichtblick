// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StatusLevel } from "@foxglove/ws-protocol";

import {
  dataTypeToFullName,
  statusLevelToAlertSeverity,
} from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/helpers";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

describe("dataTypeToFullName", () => {
  it("should convert dataType to include /msg/ on it", () => {
    const message = "unit/test";

    const result = dataTypeToFullName(message);

    expect(result).toBe("unit/msg/test");
  });

  it("should return the message unaltered if it differs from the 'text/text' format", () => {
    const message = BasicBuilder.string();

    const result = dataTypeToFullName(message);

    expect(result).toBe(message);
  });
});

describe("statusLevelToProblemSeverity", () => {
  type StatusLevelToProblemTest = [level: StatusLevel, result: string];

  it.each<StatusLevelToProblemTest>([
    [StatusLevel.INFO, "info"],
    [StatusLevel.WARNING, "warn"],
    [StatusLevel.ERROR, "error"],
  ])("should map StatusLevel %s to result %s", (level, result) => {
    expect(statusLevelToAlertSeverity(level)).toBe(result);
  });
});
