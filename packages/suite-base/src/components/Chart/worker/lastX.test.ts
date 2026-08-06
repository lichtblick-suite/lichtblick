// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { hasGapMarkerBetweenSelectionAndCursor } from "./lastX";

describe("hasGapMarkerBetweenSelectionAndCursor", () => {
  it("returns true when a NaN gap marker exists between selected point and cursor", () => {
    const datasetData = [
      { x: 0, value: true },
      { x: 0.999999, value: true },
      { x: 1, value: Number.NaN },
    ];

    expect(hasGapMarkerBetweenSelectionAndCursor(datasetData, 1, 1)).toBe(true);
    expect(hasGapMarkerBetweenSelectionAndCursor(datasetData, 0, 1.5)).toBe(true);
  });

  it("returns false when cursor is before the gap marker", () => {
    const datasetData = [
      { x: 0, value: true },
      { x: 1, value: Number.NaN },
      { x: 2, value: false },
    ];

    expect(hasGapMarkerBetweenSelectionAndCursor(datasetData, 0, 0.5)).toBe(false);
  });

  it("returns false when selected point is after the gap marker", () => {
    const datasetData = [
      { x: 0, value: true },
      { x: 1, value: Number.NaN },
      { x: 2, value: false },
    ];

    expect(hasGapMarkerBetweenSelectionAndCursor(datasetData, 2, 2.5)).toBe(false);
  });

  const datasetData = [
    { x: 0, value: true },
    { x: 1, value: Number.NaN },
  ];

  it.each([
    ["undefined dataset", undefined, 0, 1],
    ["empty dataset", [], 0, 1],
    ["non-object dataset", [1, 2, 3], 0, 1],
    ["selected index out of bounds (negative)", datasetData, -1, 1],
    ["selected index out of bounds (too large)", datasetData, 9, 1],
    ["NaN cursor x", datasetData, 0, Number.NaN],
  ])(
    "returns false for empty or invalid inputs: %s",
    (_description, data, selectedIndex, cursorX) => {
      expect(hasGapMarkerBetweenSelectionAndCursor(data, selectedIndex, cursorX)).toBe(false);
    },
  );
});
