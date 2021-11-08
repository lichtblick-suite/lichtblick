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

import { MessageEvent } from "@foxglove/studio-base/players/types";

import { RosgraphMsgs$Log } from "./types";

export default function filterMessages(
  messages: readonly MessageEvent<RosgraphMsgs$Log>[],
  filter: { minLogLevel: number; searchTerms: string[] },
): readonly MessageEvent<RosgraphMsgs$Log>[] {
  const { minLogLevel, searchTerms } = filter;
  const hasActiveFilters = minLogLevel > 1 || searchTerms.length > 0;
  // return all messages if we wouldn't filter anything
  if (!hasActiveFilters) {
    return messages;
  }

  return messages.filter((message) => {
    const logMessage = message.message;
    if (logMessage.level < minLogLevel) {
      return false;
    }

    if (searchTerms.length === 0) {
      return true;
    }

    const searchTermsInLowerCase = searchTerms.map((term) => term.toLowerCase());
    const { name, msg } = logMessage;
    const lowerCaseName = name.toLowerCase();
    const lowerCaseMsg = msg.toLowerCase();
    return searchTermsInLowerCase.some(
      (term) => lowerCaseName.includes(term) || lowerCaseMsg.includes(term),
    );
  });
}
