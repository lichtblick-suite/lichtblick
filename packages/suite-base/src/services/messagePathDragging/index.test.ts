// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { isSelfDrop } from ".";

describe("isSelfDrop", () => {
  it("blocks a drop onto the same panel the drag started from", () => {
    // Given a drag originating from and hovering over the same panel
    const sourcePanelId = "panel-a";
    const ownerPanelId = "panel-a";

    // When checking whether this is a self-drop
    const result = isSelfDrop(sourcePanelId, ownerPanelId);

    // Then it is blocked
    expect(result).toBe(true);
  });

  it("allows a drop onto a different panel", () => {
    // Given a drag originating from one panel hovering over a different panel
    const sourcePanelId = "panel-a";
    const ownerPanelId = "panel-b";

    // When checking whether this is a self-drop
    const result = isSelfDrop(sourcePanelId, ownerPanelId);

    // Then it is allowed
    expect(result).toBe(false);
  });

  it("allows a drop when the drag has no source panel (e.g. Topic List)", () => {
    // Given a drag without a source panel (e.g. from the Topic List)
    const sourcePanelId = undefined;
    const ownerPanelId = "panel-a";

    // When checking whether this is a self-drop
    const result = isSelfDrop(sourcePanelId, ownerPanelId);

    // Then it is allowed
    expect(result).toBe(false);
  });

  it("allows a drop when the target has no owner panel", () => {
    // Given a target without an owner panel id
    const sourcePanelId = "panel-a";
    const ownerPanelId = undefined;

    // When checking whether this is a self-drop
    const result = isSelfDrop(sourcePanelId, ownerPanelId);

    // Then it is allowed
    expect(result).toBe(false);
  });
});
