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

import { first, last } from "lodash";

import { diffLabels, DiffObject } from "@foxglove/studio-base/panels/RawMessages/getDiff";

export const DATA_ARRAY_PREVIEW_LIMIT = 20;
export const ROS_COMMON_MSGS: Set<string> = new Set([
  "actionlib_msgs",
  "diagnostic_msgs",
  "geometry_msgs",
  "nav_msgs",
  "sensor_msgs",
  "shape_msgs",
  "std_msgs",
  "stereo_msgs",
  "trajectory_msgs",
  "visualization_msgs",
  "turtlesim",
]);

function isTypedArray(obj: unknown) {
  return Boolean(
    obj != undefined &&
      typeof obj === "object" &&
      ArrayBuffer.isView(obj) &&
      !(obj instanceof DataView),
  );
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
    -readonly [K in typeof diffLabels["ADDED" | "CHANGED" | "DELETED"]["labelText"]]: number;
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

export function getMessageDocumentationLink(datatype: string): string {
  const parts = datatype.split("/");
  const pkg = first(parts);
  const filename = last(parts);
  return pkg != undefined && ROS_COMMON_MSGS.has(pkg)
    ? `http://docs.ros.org/api/${pkg}/html/msg/${filename}.html`
    : `https://www.google.com/search?q=${pkg}/${filename}`;
}
