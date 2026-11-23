// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { compareCodeUnits } from "./compare";

describe("compareCodeUnits", () => {
  it("returns the sign of the code unit order", () => {
    // Given / When / Then
    expect(compareCodeUnits("a", "b")).toBe(-1);
    expect(compareCodeUnits("b", "a")).toBe(1);
    expect(compareCodeUnits("a", "a")).toBe(0);
  });

  it("sorts like the default Array#sort (uppercase and punctuation by code unit)", () => {
    // Given
    const values = ["b", "a", "B", "_", "a2", "a10", "Ä"];

    // When
    const sorted = [...values].sort(compareCodeUnits);

    // Then
    expect(sorted).toEqual(["B", "_", "a", "a10", "a2", "b", "Ä"]);
  });
});
