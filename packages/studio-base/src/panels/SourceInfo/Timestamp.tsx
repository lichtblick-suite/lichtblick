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
import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
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
  color: ${colors.GREY};
  margin-left: 8px;
`;

const TimestampWrapper = styled.div`
  display: flex;
  font-family: ${fonts.MONOSPACE};
  font-size: 14px;
  font-weight: normal;
  color: ${colors.GREY};
  align-items: center;
  flex: 0 0 auto;
`;

const RosTimeWrapper = styled.div`
  display: inline-block;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 8px;
`;

const TimeWrapper = styled.div`
  display: inline-block;
  margin: 0 8px;
`;

const ROSText = styled.div`
  color: rgba(255, 255, 255, 0.5);
`;

type Props = {
  time: Time;
  timezone?: string;
};

export default function Timestamp({ time, timezone }: Props): JSX.Element {
  const currentTimeStr = formatTime(time, timezone);
  const date = formatDate(time, timezone);

  const rawTime = formatTimeRaw(time);

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
