// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { sortBy } from "lodash";
import { DeepReadonly } from "ts-essentials";

import { SettingsTreeNode, SettingsTreeNodes } from "@foxglove/studio";

/**
 * Filters and sorts roots to prepare them for rendering.
 */
export function prepareSettingsNodes(
  roots: DeepReadonly<SettingsTreeNodes>,
): DeepReadonly<Array<[string, SettingsTreeNode]>> {
  // Use sortBy here for stable sorting.
  return sortBy(
    Object.entries(roots).filter(
      (entry): entry is [string, SettingsTreeNode] => entry[1] != undefined,
    ),
    (entry) => entry[1].order,
  );
}

/**
 * Recursively filter out nodes that don't match the given filter.
 */
export function filterTreeNodes(
  nodes: DeepReadonly<SettingsTreeNodes>,
  filter: string,
): DeepReadonly<SettingsTreeNodes> {
  const result: Record<string, DeepReadonly<SettingsTreeNode>> = {};
  Object.entries(nodes).forEach(([key, node]) => {
    if (node == undefined) {
      return;
    }

    // Include node in results if any children match the filter.
    const filtered = filterTreeNodes(node.children ?? {}, filter);
    if (Object.values(filtered).length > 0) {
      result[key] = { ...node, children: filtered };
    }

    // Match on label or key in tree.
    const stringToMatch = (node.label ?? key).toLocaleLowerCase();
    if (stringToMatch.includes(filter.toLocaleLowerCase())) {
      result[key] = node;
    }
    return;
  });

  return result;
}
