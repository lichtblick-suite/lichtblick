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
import styled from "styled-components";

import { Time } from "@foxglove/rostime";
import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Flex from "@foxglove/studio-base/components/Flex";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  formatDate,
  formatTime,
  getValidatedTimeAndMethodFromString,
} from "@foxglove/studio-base/util/formatTime";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw, isTimeInRangeInclusive } from "@foxglove/studio-base/util/time";

import styles from "./index.module.scss";

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
  currentTime?: Time;
  startTime?: Time;
  endTime?: Time;
  timezone?: string;
  onSeek: (arg0: Time) => void;
  onPause: () => void;
  isPlaying: boolean;
}): JSX.Element => {
  const timeDisplayMethod = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data.playbackConfig.timeDisplayMethod ?? "ROS",
  );
  const { setPlaybackConfig } = useCurrentLayoutActions();
  const setTimeDisplayMethod = useCallback(
    (newTimeDisplayMethod: "ROS" | "TOD" | undefined) =>
      setPlaybackConfig({ timeDisplayMethod: newTimeDisplayMethod }),
    [setPlaybackConfig],
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
    (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (inputText == undefined || inputText.length === 0) {
        return;
      }
      if (!startTime || !currentTime || !endTime) {
        return;
      }

      const validTimeAndMethod = getValidatedTimeAndMethodFromString({
        text: inputText,
        date: formatDate(currentTime, timezone),
        timezone,
      });

      if (validTimeAndMethod == undefined) {
        setHasError(true);
        return;
      }

      // If input is valid, clear error state, exit edit mode, and seek to input timestamp
      setHasError(false);
      setIsEditing(false);
      if (
        validTimeAndMethod.time &&
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
    if (hasError && (inputText == undefined || inputText.length === 0 || isPlaying)) {
      setIsEditing(false);
      setHasError(false);
    }
  }, [hasError, inputText, isPlaying]);

  return (
    <Flex start style={{ flexGrow: 0, alignItems: "center", marginLeft: "8px" }}>
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
