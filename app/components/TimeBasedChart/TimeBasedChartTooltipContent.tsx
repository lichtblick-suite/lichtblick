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

import { PropsWithChildren } from "react";

import { formatTime } from "@foxglove/studio-base/util/formatTime";
import { subtractTimes, toSec, formatTimeRaw } from "@foxglove/studio-base/util/time";

import styles from "./TimeBasedChartTooltipContent.module.scss";
import { TimeBasedChartTooltipData } from "./index";

type Props = {
  tooltip: TimeBasedChartTooltipData;
};

export default function TimeBasedChartTooltipContent(
  props: PropsWithChildren<Props>,
): React.ReactElement {
  const { tooltip } = props;
  const value = typeof tooltip.value === "string" ? tooltip.value : JSON.stringify(tooltip.value);
  const { receiveTime, headerStamp } = tooltip.item;

  return (
    <div className={styles.root} data-test="TimeBasedChartTooltipContent">
      <div>
        <span className={styles.title}>Value:&nbsp;</span>
        {tooltip.constantName != undefined ? `${tooltip.constantName} (${value})` : value}
      </div>
      <div>
        <span className={styles.title}>Path:&nbsp;</span>
        {tooltip.path}
      </div>
      {tooltip.source != undefined && (
        <div>
          <span className={styles.title}>Source:&nbsp;</span>
          {tooltip.source}
        </div>
      )}
      <table>
        <tbody>
          <tr>
            <th />
            <th>receive time</th>
            {headerStamp && <th>header.stamp</th>}
          </tr>
          <tr>
            <th>ROS</th>
            <td>{formatTimeRaw(receiveTime)}</td>
            {headerStamp && <td>{formatTimeRaw(headerStamp)}</td>}
          </tr>
          <tr>
            <th>Time</th>
            {<td>{formatTime(receiveTime)}</td>}
            {headerStamp && <td>{formatTime(headerStamp)}</td>}
          </tr>
          <tr>
            <th>Elapsed</th>
            <td>{toSec(subtractTimes(receiveTime, tooltip.startTime)).toFixed(9)} sec</td>
            {headerStamp && (
              <td>{toSec(subtractTimes(headerStamp, tooltip.startTime)).toFixed(9)} sec</td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
