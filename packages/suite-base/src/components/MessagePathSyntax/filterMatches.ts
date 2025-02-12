// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePathFilter } from "@lichtblick/message-path";
import { Immutable } from "@lichtblick/suite";

export function filterMatches(filter: Immutable<MessagePathFilter>, value: unknown): boolean {
  if (typeof filter.value === "object") {
    throw new Error("filterMatches only works on paths where global variables have been filled in");
  }
  if (filter.value == undefined) {
    return false;
  }
  let currentValue = value;
  for (const name of filter.path) {
    if (typeof currentValue !== "object" || currentValue == undefined) {
      return false;
    }
    currentValue = (currentValue as Record<string, unknown>)[name];
    if (currentValue == undefined) {
      return false;
    }
  }

  // Test equality using non strict operators so we can be forgiving for comparing booleans with integers,
  // comparing numbers with strings, bigints with numbers, and so on.

  if (currentValue != undefined) {
    switch (filter.operator) {
      case "==":
        // eslint-disable-next-line @lichtblick/strict-equality
        return currentValue == filter.value;
      case "!=":
        // eslint-disable-next-line @lichtblick/strict-equality
        return currentValue != filter.value;
      case ">=":
        return currentValue >= filter.value;
      case "<=":
        return currentValue <= filter.value;
      case ">":
        return currentValue > filter.value;
      case "<":
        return currentValue < filter.value;
      default:
        return false;
    }
  }
  return false;
}
