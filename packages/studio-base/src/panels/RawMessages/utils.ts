// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import * as _ from "lodash-es";

import { ros1 } from "@foxglove/rosmsg-msgs-common";
import { foxgloveMessageSchemas } from "@foxglove/schemas/internal";
import { diffLabels, DiffObject } from "@foxglove/studio-base/panels/RawMessages/getDiff";

import type { NodeExpansion } from "./types";
import { NodeState } from "./types";

export const DATA_ARRAY_PREVIEW_LIMIT = 20;
const ROS1_COMMON_MSG_PACKAGES = new Set(Object.keys(ros1).map((key) => key.split("/")[0]!));
ROS1_COMMON_MSG_PACKAGES.add("turtlesim");

function isTypedArray(obj: unknown) {
  return Boolean(
    obj != undefined &&
      typeof obj === "object" &&
      ArrayBuffer.isView(obj) &&
      !(obj instanceof DataView),
  );
}

function invert(value: NodeState): NodeState {
  return value === NodeState.Expanded ? NodeState.Collapsed : NodeState.Expanded;
}

/*
 * Calculate the new expansion state after toggling the node at `path`.
 */
export function toggleExpansion(
  state: NodeExpansion,
  paths: Set<string>,
  key: string,
): NodeExpansion {
  if (state === "all" || state === "none") {
    const next = state === "all" ? NodeState.Expanded : NodeState.Collapsed;
    const nextState: NodeExpansion = {};
    for (const leaf of paths) {
      // Implicitly expand all descendants when toggling collapsed root node
      if (next === NodeState.Collapsed && leaf.endsWith(key)) {
        continue;
      }
      nextState[leaf] = leaf === key ? invert(next) : next;
    }
    return nextState;
  }

  const prev = state[key];
  const next = prev != undefined ? invert(prev) : NodeState.Collapsed;
  return {
    ...state,
    [key]: next,
  };
}

/**
 * Recursively traverses all keypaths in obj, for use in JSON tree expansion.
 */
export function generateDeepKeyPaths(obj: unknown, maxArrayLength: number): Set<string> {
  const keys = new Set<string>();
  const recurseMapKeys = (path: string[], nestedObj: unknown) => {
    if (nestedObj == undefined) {
      return;
    }

    if (typeof nestedObj !== "object" && typeof nestedObj !== "function") {
      return;
    }

    if (Array.isArray(nestedObj) && nestedObj.length > maxArrayLength) {
      return;
    }

    if (isTypedArray(nestedObj)) {
      return;
    }

    if (path.length > 0) {
      keys.add(path.join("~"));
    }

    for (const key of Object.getOwnPropertyNames(nestedObj)) {
      const newPath = [key, ...path];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const value = (nestedObj as any)[key];
      recurseMapKeys(newPath, value as object);
    }
  };
  recurseMapKeys([], obj);
  return keys;
}

export function getChangeCounts(
  data: DiffObject,
  startingCounts: {
    -readonly [K in (typeof diffLabels)["ADDED" | "CHANGED" | "DELETED"]["labelText"]]: number;
  },
): {
  [key: string]: number;
} {
  for (const key in data) {
    if (
      key === diffLabels.ADDED.labelText ||
      key === diffLabels.CHANGED.labelText ||
      key === diffLabels.DELETED.labelText
    ) {
      startingCounts[key]++;
    } else if (typeof data[key] === "object" && data[key] != undefined) {
      getChangeCounts(data[key] as DiffObject, startingCounts);
    }
  }
  return startingCounts;
}

const foxgloveDocsLinksByDatatype = new Map<string, string>();
for (const schema of Object.values(foxgloveMessageSchemas)) {
  const url = `https://docs.foxglove.dev/docs/visualization/message-schemas/${_.kebabCase(
    schema.name,
  )}`;
  foxgloveDocsLinksByDatatype.set(`foxglove_msgs/${schema.name}`, url);
  foxgloveDocsLinksByDatatype.set(`foxglove_msgs/msg/${schema.name}`, url);
  foxgloveDocsLinksByDatatype.set(`foxglove.${schema.name}`, url);
}

export function getMessageDocumentationLink(datatype: string): string | undefined {
  const parts = datatype.split(/[/.]/);
  const pkg = _.first(parts);
  const filename = _.last(parts);

  if (pkg != undefined && ROS1_COMMON_MSG_PACKAGES.has(pkg)) {
    return `https://docs.ros.org/api/${pkg}/html/msg/${filename}.html`;
  }

  const foxgloveDocsLink = foxgloveDocsLinksByDatatype.get(datatype);
  if (foxgloveDocsLink != undefined) {
    return foxgloveDocsLink;
  }

  return undefined;
}
