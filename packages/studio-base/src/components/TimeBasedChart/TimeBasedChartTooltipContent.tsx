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
import cx from "classnames";
import { PropsWithChildren } from "react";

import { subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { formatTime } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { TimeBasedChartTooltipData } from "./index";

type Props = {
  tooltip: TimeBasedChartTooltipData;
};

const useStyles = makeStyles((theme) => ({
  root: {
    fontFamily: fonts.MONOSPACE,
    fontSize: 11,
    lineHeight: "1.4",
    maxWidth: 350,
    overflowWrap: "break-word",
  },
  table: {
    border: "none",
    width: "100%",
  },
  tableCell: {
    border: "none",
    padding: "0 0.3em",
    lineHeight: "1.3em",
  },
  tableCellHeader: {
    color: theme.palette.neutralTertiary,
    textAlign: "center",

    ":first-child": {
      textAlign: "left",
    },
  },
  tableRow: {
    ":first-child": {
      "th, td": {
        paddingBottom: 4,
        paddingTop: 4,
      },
    },
  },
  title: {
    color: theme.palette.neutralTertiary,
  },
}));

export default function TimeBasedChartTooltipContent(
  props: PropsWithChildren<Props>,
): React.ReactElement {
  const { tooltip } = props;
  const classes = useStyles();
  const value =
    typeof tooltip.value === "string"
      ? tooltip.value
      : typeof tooltip.value === "bigint"
      ? tooltip.value.toString()
      : JSON.stringify(tooltip.value);
  const { receiveTime, headerStamp } = tooltip.item;

  return (
    <div className={classes.root} data-test="TimeBasedChartTooltipContent">
      <div>
        <span className={classes.title}>Value:&nbsp;</span>
        {tooltip.constantName != undefined ? `${tooltip.constantName} (${value})` : value}
      </div>
      <div>
        <span className={classes.title}>Path:&nbsp;</span>
        {tooltip.path}
      </div>
      {tooltip.source != undefined && (
        <div>
          <span className={classes.title}>Source:&nbsp;</span>
          {tooltip.source}
        </div>
      )}
      <table className={classes.table}>
        <tbody>
          <tr className={classes.tableRow}>
            <th className={cx(classes.tableCell, classes.tableCellHeader)} />
            <th className={cx(classes.tableCell, classes.tableCellHeader)}>receive time</th>
            {headerStamp && (
              <th className={cx(classes.tableCell, classes.tableCellHeader)}>header.stamp</th>
            )}
          </tr>
          <tr className={classes.tableRow}>
            <th className={cx(classes.tableCell, classes.tableCellHeader)}>ROS</th>
            <td className={classes.tableCell}>{formatTimeRaw(receiveTime)}</td>
            {headerStamp && <td className={classes.tableCell}>{formatTimeRaw(headerStamp)}</td>}
          </tr>
          <tr className={classes.tableRow}>
            <th className={cx(classes.tableCell, classes.tableCellHeader)}>Time</th>
            {<td className={classes.tableCell}>{formatTime(receiveTime)}</td>}
            {headerStamp && <td className={classes.tableCell}>{formatTime(headerStamp)}</td>}
          </tr>
          <tr className={classes.tableRow}>
            <th className={cx(classes.tableCell, classes.tableCellHeader)}>Elapsed</th>
            <td className={classes.tableCell}>
              {toSec(subtractTimes(receiveTime, tooltip.startTime)).toFixed(9)} sec
            </td>
            {headerStamp && (
              <td className={classes.tableCell}>
                {toSec(subtractTimes(headerStamp, tooltip.startTime)).toFixed(9)} sec
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
