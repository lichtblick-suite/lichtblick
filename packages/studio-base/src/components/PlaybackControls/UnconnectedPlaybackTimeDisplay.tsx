// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import {
  TextField,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  filledInputClasses,
  iconButtonClasses,
  inputBaseClasses,
} from "@mui/material";
import { useState, useCallback, useMemo, useEffect, MouseEvent, useRef } from "react";
import { makeStyles } from "tss-react/mui";

import { Time, isTimeInRangeInclusive } from "@foxglove/rostime";
import Stack from "@foxglove/studio-base/components/Stack";
import { IAppTimeFormat } from "@foxglove/studio-base/hooks/useAppTimeFormat";
import { TimeDisplayMethod } from "@foxglove/studio-base/types/panels";
import {
  formatDate,
  formatTime,
  getValidatedTimeAndMethodFromString,
} from "@foxglove/studio-base/util/formatTime";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

type PlaybackTimeDisplayMethodProps = {
  appTimeFormat: IAppTimeFormat;
  currentTime?: Time;
  startTime?: Time;
  endTime?: Time;
  timezone?: string;
  onSeek: (arg0: Time) => void;
  onPause: () => void;
  isPlaying: boolean;
};

const useStyles = makeStyles<{ timeDisplayMethod: TimeDisplayMethod }>()(
  (theme, { timeDisplayMethod }) => ({
    textField: {
      borderRadius: theme.shape.borderRadius,

      "&.Mui-disabled": {
        [`.${filledInputClasses.root}`]: {
          backgroundColor: "transparent",
        },
      },
      "&:not(.Mui-disabled):hover": {
        backgroundColor: theme.palette.action.hover,

        [`.${iconButtonClasses.root}`]: {
          visibility: "visible",
        },
      },
      [`.${filledInputClasses.root}`]: {
        backgroundColor: "transparent",

        ":hover": {
          backgroundColor: "transparent",
        },
      },
      [`.${inputBaseClasses.input}`]: {
        fontFeatureSettings: `${theme.typography.fontFeatureSettings}, 'zero' !important`,
        minWidth: timeDisplayMethod === "TOD" ? "28ch" : "20ch",
      },
      [`.${iconButtonClasses.root}`]: {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderLeft: `1px solid ${theme.palette.background.paper}`,
        visibility: "hidden",
        marginRight: theme.spacing(-1),
      },
    },
    textFieldError: {
      outline: `1px solid ${theme.palette.error.main}`,
      outlineOffset: -1,

      [`.${inputBaseClasses.root}`]: {
        color: theme.palette.error.main,
        borderLeftColor: theme.palette.error.main,
      },
    },
  }),
);

function PlaybackTimeMethodMenu({
  timeFormat,
  timeRawString,
  timeOfDayString,
  setTimeFormat,
}: {
  timeFormat: TimeDisplayMethod;
  timeRawString?: string;
  timeOfDayString?: string;
  setTimeFormat: (format: TimeDisplayMethod) => Promise<void>;
}): JSX.Element {
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <>
      <IconButton
        id="playback-time-display-toggle-button"
        aria-controls={open ? "playback-time-display-toggle-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
      >
        <ArrowDropDownIcon />
      </IconButton>
      <Menu
        id="playback-time-display-toggle-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          dense: true,
          "aria-labelledby": "playback-time-display-toggle-button",
        }}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
      >
        {[
          { key: "TOD", label: timeOfDayString ?? "Time of Day" },
          { key: "SEC", label: timeRawString ?? "Seconds" },
        ].map((option) => (
          <MenuItem
            key={option.key}
            selected={timeFormat === option.key}
            onClick={async () => {
              await setTimeFormat(option.key as TimeDisplayMethod);
              handleClose();
            }}
          >
            {timeFormat === option.key && (
              <ListItemIcon>
                <CheckIcon fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText
              inset={timeFormat !== option.key}
              primary={option.label}
              primaryTypographyProps={{ variant: "inherit" }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export function UnconnectedPlaybackTimeDisplay({
  appTimeFormat,
  currentTime,
  startTime,
  endTime,
  timezone,
  onSeek,
  onPause,
  isPlaying,
}: PlaybackTimeDisplayMethodProps): JSX.Element {
  const { classes, cx } = useStyles({ timeDisplayMethod: appTimeFormat.timeFormat });
  const timeOutID = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const timeRawString = useMemo(
    () => (currentTime ? formatTimeRaw(currentTime) : undefined),
    [currentTime],
  );
  const timeOfDayString = useMemo(
    () =>
      currentTime
        ? `${formatDate(currentTime, timezone)} ${formatTime(currentTime, timezone)}`
        : undefined,
    [currentTime, timezone],
  );
  const currentTimeString = useMemo(
    () => (appTimeFormat.timeFormat === "SEC" ? timeRawString : timeOfDayString),
    [appTimeFormat.timeFormat, timeRawString, timeOfDayString],
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string | undefined>(currentTimeString ?? undefined);
  const [hasError, setHasError] = useState<boolean>(false);

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
        if (validTimeAndMethod.method !== appTimeFormat.timeFormat) {
          void appTimeFormat.setTimeFormat(validTimeAndMethod.method);
        }
      }
    },
    [inputText, startTime, currentTime, endTime, timezone, onSeek, appTimeFormat],
  );

  useEffect(() => {
    // If user submits an empty input field or resumes playback, clear error state and show current timestamp
    if (hasError && (inputText == undefined || inputText.length === 0 || isPlaying)) {
      setIsEditing(false);
      setHasError(false);
    }

    return () => {
      if (timeOutID.current != undefined) {
        clearTimeout(timeOutID.current);
      }
    };
  }, [hasError, inputText, isPlaying]);

  return (
    <Stack direction="row" alignItems="center" flexGrow={0} gap={0.5}>
      {currentTime ? (
        <form onSubmit={onSubmit} style={{ width: "100%" }}>
          <TextField
            className={cx(classes.textField, { [classes.textFieldError]: hasError })}
            aria-label="Playback Time Method"
            data-testid="PlaybackTime-text"
            value={isEditing ? inputText : currentTimeString}
            error={hasError}
            variant="filled"
            size="small"
            InputProps={{
              startAdornment: hasError ? <WarningIcon color="error" /> : undefined,
              endAdornment: (
                <PlaybackTimeMethodMenu
                  {...{
                    currentTime,
                    timezone,
                    timeOfDayString,
                    timeRawString,
                    timeFormat: appTimeFormat.timeFormat,
                    setTimeFormat: appTimeFormat.setTimeFormat,
                  }}
                />
              ),
            }}
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
              timeOutID.current = setTimeout(() => setHasError(false), 600);
            }}
            onChange={(event) => setInputText(event.target.value)}
          />
        </form>
      ) : (
        <TextField
          className={cx(classes.textField, "Mui-disabled")}
          disabled
          variant="filled"
          size="small"
          defaultValue={
            appTimeFormat.timeFormat === "SEC" ? "0000000000.000000000" : "0000-00-00 00:00:00.000"
          }
          InputProps={{
            endAdornment: (
              <IconButton edge="end" disabled>
                <ArrowDropDownIcon />
              </IconButton>
            ),
          }}
        />
      )}
    </Stack>
  );
}
