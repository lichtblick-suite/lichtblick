// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable no-restricted-syntax */

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PATH_NAME_AGGREGATOR } from "@lichtblick/suite-base/panels/RawMessagesCommon/constants";
import { TreeNode } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

function isExpandable(value: unknown): boolean {
  if (value == null) {
    return false;
  }

  if (typeof value !== "object") {
    return false;
  }

  if (ArrayBuffer.isView(value)) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Object.keys(value).length > 0;
}

export function flattenTreeData(
  data: unknown,
  expandedNodes: Set<string>,
  parentPath: string = "",
  depth: number = 0,
  keyPath: (string | number)[] = [],
): TreeNode[] {
  const nodes: TreeNode[] = [];

  if (data == null || typeof data !== "object") {
    return nodes;
  }

  if (ArrayBuffer.isView(data)) {
    return nodes;
  }

  const entries = Array.isArray(data)
    ? data.map((item, index) => [index, item] as [number, unknown])
    : Object.entries(data);

  return entries.flatMap(([key, value]) => {
    const currentKeyPath = [key, ...keyPath];
    const nodePath = parentPath ? `${key}${PATH_NAME_AGGREGATOR}${parentPath}` : String(key);

    const node: TreeNode = {
      key: nodePath,
      label: String(key),
      value,
      depth,
      isExpandable: isExpandable(value),
      keyPath: currentKeyPath,
      parentPath,
    };

    // If node is expandable and expanded, return node + children
    // Otherwise just return the node
    if (node.isExpandable && expandedNodes.has(nodePath)) {
      return [node, ...flattenTreeData(value, expandedNodes, nodePath, depth + 1, currentKeyPath)];
    }

    return [node];
  });
}
