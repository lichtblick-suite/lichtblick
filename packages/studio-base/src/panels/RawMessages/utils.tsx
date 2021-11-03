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

import { diffLabels, DiffObject } from "@foxglove/studio-base/panels/RawMessages/getDiff";
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

function getChangeCounts(
  data: DiffObject,
  startingCounts: {
    -readonly [K in typeof diffLabels["ADDED" | "CHANGED" | "DELETED"]["labelText"]]: number;
  },
) {
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

export const getItemStringForDiff = ({
  data,
  itemType,
  isInverted,
}: {
  type: string;
  data: DiffObject;
  itemType: ReactNode;
  isInverted: boolean;
}): ReactNode => {
  const { ADDED, DELETED, CHANGED, ID } = diffLabels;
  const id = data[ID.labelText] as DiffObject | undefined;
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
        {counts[ADDED.labelText] !== 0 || counts[DELETED.labelText] !== 0 ? (
          <span
            style={{
              display: "inline-block",
              fontSize: "0.8em",
              padding: 2,
              borderRadius: 3,
              backgroundColor: isInverted ? colors.DARK6 : colors.LIGHT1,
              marginRight: 5,
            }}
          >
            <span style={{ color: colors.GREEN }}>
              {counts[ADDED.labelText] !== 0
                ? `${diffLabels.ADDED.indicator}${counts[ADDED.labelText]} `
                : undefined}
            </span>
            <span style={{ color: colors.RED }}>
              {counts[DELETED.labelText] !== 0
                ? `${diffLabels.DELETED.indicator}${counts[DELETED.labelText]}`
                : undefined}
            </span>
          </span>
        ) : undefined}
        {counts[CHANGED.labelText] !== 0 ? (
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
            {counts[CHANGED.labelText] !== 0 ? " " : undefined}
          </span>
        ) : undefined}
      </span>
    </>
  );
};

export function getMessageDocumentationLink(datatype: string): string {
  const parts = datatype.split("/");
  const pkg = first(parts);
  const filename = last(parts);
  return pkg != undefined && ROS_COMMON_MSGS.has(pkg)
    ? `http://docs.ros.org/api/${pkg}/html/msg/${filename}.html`
    : `https://www.google.com/search?q=${pkg}/${filename}`;
}
