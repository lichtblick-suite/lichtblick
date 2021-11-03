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
import ChevronRightIcon from "@mdi/svg/svg/chevron-right.svg";
import styled from "styled-components";

import { Time } from "@foxglove/rostime";
import CopyText from "@foxglove/studio-base/components/CopyText";
import Icon from "@foxglove/studio-base/components/Icon";
import { formatDate, formatTime } from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

const SRoot = styled.div`
  display: flex;
  flex: 0 0 auto;
  align-items: center;
`;

const DateWrapper = styled.div`
  font-family: ${fonts.MONOSPACE};
  font-size: 14px;
  font-weight: normal;
  color: ${({ theme }) => theme.palette.neutralSecondary};
  margin-left: 8px;
`;

const TimestampWrapper = styled.div`
  display: flex;
  font-family: ${fonts.MONOSPACE};
  font-size: 14px;
  font-weight: normal;
  color: ${({ theme }) => theme.palette.neutralSecondary};
  align-items: center;
  flex: 0 0 auto;
`;

const RosTimeWrapper = styled.div`
  display: inline-block;
  color: ${({ theme }) => theme.palette.neutralTertiary};
  margin: 0 8px;
`;

const RelativeTimeWrapper = styled.div`
  display: inline-block;
  color: ${({ theme }) => theme.palette.neutralSecondary};
  margin: 0 8px;
`;

const TimeWrapper = styled.div`
  display: inline-block;
  margin: 0 8px;
`;

const ROSText = styled.div`
  color: ${({ theme }) => theme.palette.neutralTertiary};
`;

type Props = {
  time: Time;
  timezone?: string;
};

export default function Timestamp({ time, timezone }: Props): JSX.Element {
  const rawTime = formatTimeRaw(time);

  if (!isAbsoluteTime(time)) {
    return (
      <SRoot>
        <TimestampWrapper>
          <RelativeTimeWrapper>{rawTime}</RelativeTimeWrapper>
          <CopyText copyText={rawTime} tooltip="Copy time to clipboard">
            sec
          </CopyText>
        </TimestampWrapper>
      </SRoot>
    );
  }

  const currentTimeStr = formatTime(time, timezone);
  const date = formatDate(time, timezone);

  return (
    <SRoot>
      <DateWrapper>{date}</DateWrapper>
      <Icon style={{ margin: "0 4px", opacity: "0.5" }} size="medium" clickable={false}>
        <ChevronRightIcon />
      </Icon>
      <TimestampWrapper>
        <TimeWrapper>
          <span>{currentTimeStr}</span>
        </TimeWrapper>
        <RosTimeWrapper>
          <span>{rawTime}</span>
        </RosTimeWrapper>
        <CopyText copyText={rawTime} tooltip="Copy ROS time to clipboard">
          <ROSText>ROS</ROSText>
        </CopyText>
      </TimestampWrapper>
    </SRoot>
  );
}

const DURATION_20_YEARS_SEC = 20 * 365 * 24 * 60 * 60;

// Values "too small" to be absolute epoch-based times are probably relative durations.
function isAbsoluteTime(time: Time): boolean {
  return time.sec > DURATION_20_YEARS_SEC;
}
