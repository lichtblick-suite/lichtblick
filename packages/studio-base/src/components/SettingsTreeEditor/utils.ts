// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { sortBy } from "lodash";
import { DeepReadonly } from "ts-essentials";

import { SettingsTreeRoots, SettingsTreeNode } from "./types";

/**
 * Filters and sorts roots to prepare them for rendering.
 */
export function prepareSettingsRoots(
  roots: DeepReadonly<SettingsTreeRoots>,
): DeepReadonly<Array<[string, SettingsTreeNode]>> {
  // Use sortBy here for stable sorting.
  return sortBy(
    Object.entries(roots).filter((kv): kv is [string, SettingsTreeNode] => kv[1] != undefined),
    (kv) => kv[1].order ?? Number.MAX_SAFE_INTEGER,
  );
}
