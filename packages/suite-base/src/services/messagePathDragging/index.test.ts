// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { isSelfDrop } from ".";

describe("isSelfDrop", () => {
  it("blocks a drop onto the same panel the drag started from", () => {
    expect(isSelfDrop("panel-a", "panel-a")).toBe(true);
  });

  it("allows a drop onto a different panel", () => {
    expect(isSelfDrop("panel-a", "panel-b")).toBe(false);
  });

  it("allows a drop when the drag has no source panel (e.g. Topic List)", () => {
    expect(isSelfDrop(undefined, "panel-a")).toBe(false);
  });

  it("allows a drop when the target has no owner panel", () => {
    expect(isSelfDrop("panel-a", undefined)).toBe(false);
  });
});
