// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { severityToBadgeColor } from "./utils";

describe("severityToBadgeColor", () => {
  it("returns 'warning' when severity is 'warn'", () => {
    expect(severityToBadgeColor("warn")).toBe("warning");
  });

  it("returns 'info' when severity is 'info'", () => {
    expect(severityToBadgeColor("info")).toBe("info");
  });

  it("returns 'error' when severity is 'error'", () => {
    expect(severityToBadgeColor("error")).toBe("error");
  });

  it("returns 'error' when severity is undefined", () => {
    expect(severityToBadgeColor(undefined)).toBe("error");
  });
});
