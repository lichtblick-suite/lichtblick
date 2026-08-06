// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type DatumLike = {
  x: number;
  value: unknown;
};

function isDatumLike(value: unknown): value is DatumLike {
  return (
    value != undefined &&
    typeof value === "object" &&
    "x" in value &&
    typeof value.x === "number" &&
    "value" in value
  );
}

function isGapValue(value: unknown): boolean {
  return typeof value === "number" && Number.isNaN(value);
}

// Returns true when a NaN gap marker exists between the selected point and hovered X.
export function hasGapMarkerBetweenSelectionAndCursor(
  datasetData: unknown[] | undefined,
  selectedIndex: number,
  cursorX: number,
): boolean {
  if (datasetData == undefined) {
    return false;
  }

  if (selectedIndex < 0 || selectedIndex >= datasetData.length) {
    return false;
  }

  if (!Number.isFinite(cursorX)) {
    return false;
  }

  for (let index = selectedIndex + 1; index < datasetData.length; index++) {
    const datum = datasetData[index];
    if (!isDatumLike(datum)) {
      continue;
    }

    if (datum.x > cursorX) {
      break;
    }

    if (isGapValue(datum.value)) {
      return true;
    }
  }

  return false;
}
