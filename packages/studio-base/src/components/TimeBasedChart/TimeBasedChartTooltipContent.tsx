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

import { makeStyles } from "@fluentui/react";
import { PropsWithChildren } from "react";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { TimeBasedChartTooltipData } from "./index";

type Props = {
  content: TimeBasedChartTooltipData[];
};

const useStyles = makeStyles((theme) => ({
  root: {
    fontFamily: fonts.MONOSPACE,
    fontSize: 11,
    lineHeight: "1.4",
    overflowWrap: "break-word",
  },
  multiValueItem: {
    paddingBottom: theme.spacing.s2,
  },
  path: {
    whiteSpace: "nowrap",
    color: theme.palette.neutralTertiary,
  },
}));

export default function TimeBasedChartTooltipContent(
  props: PropsWithChildren<Props>,
): React.ReactElement {
  const { content } = props;
  const classes = useStyles();

  // If only one value is present we don't show the series name since it is the only series present
  if (content.length === 1) {
    return (
      <div className={classes.root} data-test="TimeBasedChartTooltipContent">
        {content.map((item, idx) => {
          const value =
            typeof item.value === "string"
              ? item.value
              : typeof item.value === "bigint"
              ? item.value.toString()
              : JSON.stringify(item.value);
          return (
            <div key={idx}>
              {value}
              {item.constantName != undefined ? ` (${item.constantName})` : ""}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={classes.root} data-test="TimeBasedChartTooltipContent">
      {content.map((item, idx) => {
        const value =
          typeof item.value === "string"
            ? item.value
            : typeof item.value === "bigint"
            ? item.value.toString()
            : JSON.stringify(item.value);
        return (
          <div key={idx} className={classes.multiValueItem}>
            <div className={classes.path}>{item.path}</div>
            <div>
              {value}
              {item.constantName != undefined ? ` (${item.constantName})` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
