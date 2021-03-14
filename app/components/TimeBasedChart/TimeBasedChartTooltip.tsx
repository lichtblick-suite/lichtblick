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

import styles from "./TimeBasedChartTooltip.module.scss";
import { TimeBasedChartTooltipData } from "./index";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import { formatTime } from "@foxglove-studio/app/util/formatTime";
import { subtractTimes, toSec, formatTimeRaw } from "@foxglove-studio/app/util/time";

type Props = {
  children: React.ReactElement<any>;
  tooltip: TimeBasedChartTooltipData;
};
export default class TimeBasedChartTooltip extends React.PureComponent<Props> {
  render() {
    const { tooltip } = this.props;
    const value = typeof tooltip.value === "string" ? tooltip.value : JSON.stringify(tooltip.value);
    const { receiveTime, headerStamp } = tooltip.item;
    const content = (
      <div className={styles.root}>
        <div>
          <span className={styles.title}>Value:&nbsp;</span>
          {tooltip.constantName ? `${tooltip.constantName} (${value})` : value}
        </div>
        <div>
          <span className={styles.title}>Path:&nbsp;</span>
          {tooltip.path}
        </div>
        {tooltip.source != null && (
          <div>
            <span className={styles.title}>Source:&nbsp;</span>
            {tooltip.source}
          </div>
        )}
        {receiveTime && headerStamp && (
          <table>
            <tbody>
              <tr>
                <th />
                {receiveTime && <th>receive time</th>}
                {headerStamp && <th>header.stamp</th>}
              </tr>
              <tr>
                <th>ROS</th>
                {receiveTime && <td>{formatTimeRaw(receiveTime)}</td>}
                {headerStamp && <td>{formatTimeRaw(headerStamp)}</td>}
              </tr>
              <tr>
                <th>Time</th>
                {receiveTime && <td>{formatTime(receiveTime)}</td>}
                {headerStamp && <td>{formatTime(headerStamp)}</td>}
              </tr>
              <tr>
                <th>Elapsed</th>
                {receiveTime && (
                  <td>{toSec(subtractTimes(receiveTime, tooltip.startTime)).toFixed(9)} sec</td>
                )}
                {headerStamp && (
                  <td>{toSec(subtractTimes(headerStamp, tooltip.startTime)).toFixed(9)} sec</td>
                )}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    );

    return (
      <Tooltip defaultShown placement="top" contents={content}>
        {this.props.children}
      </Tooltip>
    );
  }
}
