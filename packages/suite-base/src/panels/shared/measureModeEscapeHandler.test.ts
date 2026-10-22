// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { createMeasureModeEscapeHandler } from "./measureModeEscapeHandler";

describe("createMeasureModeEscapeHandler", () => {
  it("toggles measure mode off and returns nothing when active", () => {
    // Given
    const toggleActive = jest.fn();
    const handler = createMeasureModeEscapeHandler({ active: true, toggleActive });

    // When
    const result = handler();

    // Then
    expect(toggleActive).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it("does not toggle and returns false when not active", () => {
    // Given
    const toggleActive = jest.fn();
    const handler = createMeasureModeEscapeHandler({ active: false, toggleActive });

    // When
    const result = handler();

    // Then
    expect(toggleActive).not.toHaveBeenCalled();
    expect(result).toBe(false);
  });
});
