// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";

import { getNormalizedMessage, getNormalizedLevel } from "./conversion";
import { LogMessageEvent } from "./types";

export default function filterMessages(
  events: readonly LogMessageEvent[],
  filter: {
    minLogLevel: number;
    searchTerms: string[];
    nameFilter: Record<string, { visible?: boolean }>;
  },
): readonly LogMessageEvent[] {
  const { minLogLevel, searchTerms, nameFilter } = filter;
  const hasActiveFilters =
    minLogLevel > 1 ||
    searchTerms.length > 0 ||
    Object.values(nameFilter).some(({ visible }) => visible === false);
  // return all messages if we wouldn't filter anything
  if (!hasActiveFilters) {
    return events;
  }

  const searchTermsInLowerCase = searchTerms.map((term) => term.toLowerCase());

  return events.filter((event) => {
    const logMessage = event.message;
    const effectiveLogLevel = getNormalizedLevel(event.schemaName, logMessage);
    if (effectiveLogLevel < minLogLevel) {
      return false;
    }

    const maybeName = mightActuallyBePartial(logMessage).name;
    if (maybeName != undefined && nameFilter[maybeName]?.visible === false) {
      return false;
    }

    if (searchTerms.length === 0) {
      return true;
    }

    const lowerCaseName = mightActuallyBePartial(logMessage).name?.toLowerCase() ?? "";
    const lowerCaseMsg = getNormalizedMessage(logMessage).toLowerCase();
    return searchTermsInLowerCase.some(
      (term) => lowerCaseName.includes(term) || lowerCaseMsg.includes(term),
    );
  });
}
