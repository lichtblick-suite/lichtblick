// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Time } from "rosbag";
import styled from "styled-components";

import { setPlaybackConfig } from "@foxglove-studio/app/actions/panels";
import Dropdown from "@foxglove-studio/app/components/Dropdown";
import DropdownItem from "@foxglove-studio/app/components/Dropdown/DropdownItem";
import Flex from "@foxglove-studio/app/components/Flex";
import {
  formatDate,
  formatTime,
  getValidatedTimeAndMethodFromString,
} from "@foxglove-studio/app/util/formatTime";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";
import { formatTimeRaw, isTimeInRangeInclusive } from "@foxglove-studio/app/util/time";

import styles from "./index.module.scss";

const MAX_WIDTH = 200;

const SInput = styled.input`
  padding: 8px 4px;
  width: calc(100% - 4px);
`;
const STimestamp = styled.span`
  padding: 8px 4px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background-color: ${colors.DARK3};
    opacity: 0.8;
  }
`;

const PlaybackTimeDisplayMethod = ({
  currentTime,
  startTime,
  endTime,
  timezone,
  onSeek,
  onPause,
  isPlaying,
}: {
  currentTime: Time;
  startTime: Time;
  endTime: Time;
  timezone?: string;
  onSeek: (arg0: Time) => void;
  onPause: () => void;
  isPlaying: boolean;
}) => {
  const timeDisplayMethod = useSelector(
    (state: any) => state.persistedState.panels.playbackConfig.timeDisplayMethod || "ROS",
  );
  const dispatch = useDispatch();
  const setTimeDisplayMethod = useCallback(
    (newTimeDisplayMethod) =>
      dispatch(setPlaybackConfig({ timeDisplayMethod: newTimeDisplayMethod })),
    [dispatch],
  );

  const timestampInputRef = useRef<HTMLInputElement>(ReactNull);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const currentTimeString = useMemo(() => {
    if (currentTime) {
      return timeDisplayMethod === "ROS"
        ? formatTimeRaw(currentTime)
        : formatTime(currentTime, timezone);
    }
    return undefined;
  }, [currentTime, timeDisplayMethod, timezone]);
  const [inputText, setInputText] = useState<string | undefined>(currentTimeString ?? undefined);
  const [hasError, setHasError] = useState<boolean>(false);

  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();

      if (!inputText?.length) {
        return;
      }

      const validTimeAndMethod = getValidatedTimeAndMethodFromString({
        text: inputText,
        date: formatDate(currentTime, timezone),
        timezone,
      });

      if (!validTimeAndMethod) {
        setHasError(true);
        return;
      }

      // If input is valid, clear error state, exit edit mode, and seek to input timestamp
      setHasError(false);
      setIsEditing(false);
      if (
        validTimeAndMethod?.time &&
        isTimeInRangeInclusive(validTimeAndMethod.time, startTime, endTime)
      ) {
        onSeek(validTimeAndMethod.time);
        if (validTimeAndMethod.method !== timeDisplayMethod) {
          setTimeDisplayMethod(validTimeAndMethod.method);
        }
      }
    },
    [
      currentTime,
      endTime,
      inputText,
      onSeek,
      setTimeDisplayMethod,
      startTime,
      timeDisplayMethod,
      timezone,
    ],
  );

  useEffect(() => {
    // If user submits an empty input field or resumes playback, clear error state and show current timestamp
    if (hasError && (!inputText?.length || isPlaying)) {
      setIsEditing(false);
      setHasError(false);
    }
  }, [hasError, inputText, isPlaying]);

  return (
    <Flex start style={{ maxWidth: `${MAX_WIDTH}px`, alignItems: "center", marginLeft: "8px" }}>
      {currentTime ? (
        isEditing ? (
          <form onSubmit={onSubmit} style={{ width: "100%" }}>
            <SInput
              ref={timestampInputRef}
              data-test="PlaybackTime-text"
              style={hasError ? { border: `1px solid ${colors.RED}` } : {}}
              value={inputText}
              autoFocus
              onFocus={(e) => e.target.select()}
              onBlur={onSubmit}
              onChange={({ target: { value } }) => setInputText(value)}
            />
          </form>
        ) : (
          <STimestamp
            data-test="PlaybackTime-text"
            onClick={() => {
              onPause();
              setIsEditing(true);
              setInputText(currentTimeString);
            }}
          >
            {currentTimeString}
          </STimestamp>
        )
      ) : (
        <span data-test="PlaybackTime-text">–</span>
      )}
      <Dropdown
        position="above"
        value={timeDisplayMethod}
        menuStyle={{
          width: `${MAX_WIDTH - 45}px`,
          marginLeft: currentTime ? `-${MAX_WIDTH - 90}px` : `-${MAX_WIDTH - 90}px`,
        }}
        text={timeDisplayMethod}
        onChange={(val) => setTimeDisplayMethod(val)}
        btnClassname={styles.timeDisplayMethodButton}
      >
        <DropdownItem value="TOD">
          <span key="day">Time of day (TOD)</span>
        </DropdownItem>
        <DropdownItem value="ROS">
          <span key="ros">ROS time</span>
        </DropdownItem>
      </Dropdown>
    </Flex>
  );
};

export default PlaybackTimeDisplayMethod;
