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

import { memoize, uniq } from "lodash";
import { Parser, Grammar } from "nearley";

import filterMap from "@foxglove/studio-base/util/filterMap";

import { RosPath } from "./constants";
import grammar from "./grammar.ne";

const grammarObj = Grammar.fromCompiled(grammar);

const parseRosPath = memoize((path: string): RosPath | undefined => {
  // Need to create a new Parser object for every new string to parse (should be cheap).
  const parser = new Parser(grammarObj);
  try {
    return parser.feed(path).results[0];
  } catch (_) {
    return undefined;
  }
});
export default parseRosPath;

export function getTopicsFromPaths(paths: string[]): string[] {
  return uniq(
    filterMap(paths, (path) => {
      const rosPath = parseRosPath(path);
      return rosPath ? rosPath.topicName : undefined;
    }),
  );
}
