// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ImmutableDataset, StateTransitionPath } from "./types";

function presence<T>(value: undefined | T): undefined | T {
  if (value === "") {
    return undefined;
  }

  return value ?? undefined;
}

export function stateTransitionPathDisplayName(
  path: Readonly<StateTransitionPath>,
  index: number,
): string {
  return presence(path.label) ?? presence(path.value) ?? `Series ${index + 1}`;
}

export function datasetContainsArray(dataset: ImmutableDataset): boolean {
  // We need to detect when the path produces more than one data point,
  // since that is invalid input
  let hasMessages = false;
  for (const data of dataset) {
    for (const message of data ?? []) {
      // Runs on every range-data update, so stop at the first message that isn't an array.
      if (message.queriedData.length <= 1) {
        return false;
      }
      hasMessages = true;
    }
  }
  return hasMessages;
}
