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

import {
  DefaultButton,
  DirectionalHint,
  ITextFieldStyles,
  Stack,
  TextField,
  useTheme,
} from "@fluentui/react";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";

import { Time, isTimeInRangeInclusive } from "@foxglove/rostime";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import {
  formatDate,
  formatTime,
  getValidatedTimeAndMethodFromString,
} from "@foxglove/studio-base/util/formatTime";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

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
  const timestampInputRef = useRef<HTMLInputElement>(ReactNull);
  const timeFormat = useAppTimeFormat();
  const timeRawString = useMemo(
    () => (currentTime ? formatTimeRaw(currentTime) : undefined),
    [currentTime],
  );
  const timeOfDayString = useMemo(
    () => (currentTime ? formatTime(currentTime, timezone) : undefined),
    [currentTime, timezone],
  );
  const currentTimeString = useMemo(
    () => (timeFormat.timeFormat === "SEC" ? timeRawString : timeOfDayString),
    [timeFormat.timeFormat, timeRawString, timeOfDayString],
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string | undefined>(currentTimeString ?? undefined);
  const [hasError, setHasError] = useState<boolean>(false);

  const theme = useTheme();
  const textFieldStyles = useMemo(
    () =>
      ({
        errorMessage: {
          display: "none",
        },
        field: {
          margin: 0,
          padding: 0,
          whiteSpace: "nowrap",
          fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero'`,
          backgroundColor: "transparent",

          ":hover": {
            borderRadius: 2,
            backgroundColor: theme.semanticColors.inputBackground,
          },
          ":focus": {
            backgroundColor: theme.semanticColors.inputBackground,
          },
        },
        fieldGroup: {
          border: "none",
          backgroundColor: "transparent",
          // The flex-sizing does not correctly calculate the <input> field width for all font
          // sizes, so we increase the width to compensate
          width: "102%",
        },
        icon: {
          height: 20,
          color: hasError ? theme.semanticColors.errorIcon : undefined,
        },
        root: {
          marginLeft: theme.spacing.s1,

          "&.is-disabled input[disabled]": {
            background: "transparent",
            cursor: "not-allowed",
          },
        },
      } as Partial<ITextFieldStyles>),
    [hasError, theme],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
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

      if (
        validTimeAndMethod.time &&
        isTimeInRangeInclusive(validTimeAndMethod.time, startTime, endTime)
      ) {
        onSeek(validTimeAndMethod.time);
        if (validTimeAndMethod.method !== timeFormat.timeFormat) {
          void timeFormat.setTimeFormat(validTimeAndMethod.method);
        }
      }
    },
    [inputText, startTime, currentTime, endTime, timezone, onSeek, timeFormat],
  );

  useEffect(() => {
    // If user submits an empty input field or resumes playback, clear error state and show current timestamp
    if (hasError && (inputText == undefined || inputText.length === 0 || isPlaying)) {
      setIsEditing(false);
      setHasError(false);
    }
  }, [hasError, inputText, isPlaying]);

  return (
    <Stack
      horizontal
      verticalAlign="center"
      grow={0}
      tokens={{
        childrenGap: theme.spacing.s2,
      }}
    >
      {currentTime ? (
        <form onSubmit={onSubmit} style={{ width: "100%" }}>
          <TextField
            ariaLabel="Playback Time Method"
            data-test="PlaybackTime-text"
            elementRef={timestampInputRef}
            value={isEditing ? inputText : currentTimeString}
            errorMessage={hasError ? "Invalid Time" : undefined}
            onFocus={(e) => {
              onPause();
              setHasError(false);
              setIsEditing(true);
              setInputText(currentTimeString);
              e.target.select();
            }}
            onBlur={(e) => {
              onSubmit(e);
              setIsEditing(false);
              setTimeout(() => setHasError(false), 600);
            }}
            iconProps={{ iconName: hasError ? "Warning" : undefined }}
            size={21}
            styles={textFieldStyles}
            onChange={(_, newValue) => setInputText(newValue)}
          />
        </form>
      ) : (
        <TextField disabled size={13} styles={textFieldStyles} defaultValue="–" />
      )}
      <DefaultButton
        menuProps={{
          directionalHint: DirectionalHint.topLeftEdge,
          directionalHintFixed: true,
          gapSpace: 3,
          items: [
            {
              canCheck: true,
              key: "TOD",
              text: timeOfDayString ? timeOfDayString : "Time of Day",
              isChecked: timeFormat.timeFormat === "TOD",
              onClick: () => void timeFormat.setTimeFormat("TOD"),
            },
            {
              canCheck: true,
              key: "SEC",
              text: timeRawString ? timeRawString : "Seconds",
              isChecked: timeFormat.timeFormat === "SEC",
              onClick: () => void timeFormat.setTimeFormat("SEC"),
            },
          ],
        }}
        styles={{
          root: {
            border: "none",
            background: theme.semanticColors.buttonBackgroundHovered,
            padding: 0,
            minWidth: "24px",
          },
          rootHovered: {
            background: theme.semanticColors.buttonBackgroundPressed,
          },
          label: theme.fonts.small,
          menuIcon: {
            fontSize: theme.fonts.tiny.fontSize,
          },
        }}
      ></DefaultButton>
    </Stack>
  );
};

export default PlaybackTimeDisplayMethod;
