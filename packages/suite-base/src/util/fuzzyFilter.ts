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

// Fuzzy matching: allow filter "fzmg" to match "fuzzy/matching".
// Score by how early in the string matches appear.
export default function fuzzyFilter<T>({
  options,
  filter,
  getText,
  sort = true,
}: {
  options: T[];
  filter: string | undefined;
  getText: (option: T) => string;
  sort?: boolean;
}): T[] {
  if (filter == undefined || filter === "") {
    return options;
  }
  const needle = filter.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (needle.length === 0) {
    return options;
  }

  type Result = { option: T; score: number };
  const results: Result[] = [];

  for (const option of options) {
    const haystack = getText(option).toLowerCase();
    let charPos = -1;
    let score = 0;
    for (const char of needle) {
      charPos = haystack.indexOf(char, charPos + 1);
      if (charPos === -1) {
        break;
      }
      score += charPos;
    }
    if (charPos !== -1) {
      results.push({
        option,
        score: score * haystack.length,
      });
    }
  }

  if (sort) {
    results.sort((a, b) => a.score - b.score);
  }
  return results.map((result: Result): T => result.option);
}
