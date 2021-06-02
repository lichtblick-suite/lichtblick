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
import { ReactNode } from "react";

import { diffLabels } from "@foxglove/studio-base/panels/RawMessages/getDiff";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

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
function getChangeCounts(data: any, startingCounts: any) {
  const possibleLabelTexts = Object.keys(startingCounts);
  for (const key in data) {
    if (possibleLabelTexts.includes(key)) {
      startingCounts[key]++;
    } else if (typeof data[key] === "object") {
      getChangeCounts(data[key], startingCounts);
    }
  }
  return startingCounts;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getItemStringForDiff = (_type: string, data: any, itemType: ReactNode): ReactNode => {
  const { ADDED, DELETED, CHANGED, ID } = diffLabels;
  const id = data[ID.labelText];
  const idLabel = id
    ? Object.keys(id)
        .map((key) => `${key}: ${id[key]}`)
        .join(", ")
    : undefined;
  const startingCounts = { [ADDED.labelText]: 0, [CHANGED.labelText]: 0, [DELETED.labelText]: 0 };
  const counts = getChangeCounts(data, startingCounts);
  return (
    <>
      {id ? (
        <span>
          {itemType} {idLabel}
        </span>
      ) : undefined}
      <span style={{ float: "right", color: CHANGED.color }}>
        {counts[ADDED.labelText] || counts[DELETED.labelText] ? (
          <span
            style={{
              display: "inline-block",
              fontSize: "0.8em",
              padding: 2,
              borderRadius: 3,
              backgroundColor: ADDED.color,
              marginRight: 5,
            }}
          >
            <span style={{ color: colors.GREEN }}>
              {counts[ADDED.labelText]
                ? `${diffLabels.ADDED.indicator}${counts[ADDED.labelText]} `
                : undefined}
            </span>
            <span style={{ color: colors.RED }}>
              {counts[DELETED.labelText]
                ? `${diffLabels.DELETED.indicator}${counts[DELETED.labelText]}`
                : undefined}
            </span>
          </span>
        ) : undefined}
        {counts[CHANGED.labelText] ? (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: 3,
              borderRadius: 3,
              backgroundColor: CHANGED.color,
              marginRight: 5,
            }}
          >
            {counts[CHANGED.labelText] ? " " : undefined}
          </span>
        ) : undefined}
      </span>
    </>
  );
};

export function getMessageDocumentationLink(datatype: string): string | undefined {
  const parts = datatype.split("/");
  const pkg = first(parts);
  const filename = last(parts);
  return ROS_COMMON_MSGS.has(pkg as any)
    ? `http://docs.ros.org/api/${pkg}/html/msg/${filename}.html`
    : `https://www.google.com/search?q=${pkg}/${filename}`;
}
