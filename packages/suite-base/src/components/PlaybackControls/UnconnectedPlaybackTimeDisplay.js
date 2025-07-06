import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import { TextField, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, filledInputClasses, iconButtonClasses, inputBaseClasses, } from "@mui/material";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { makeStyles } from "tss-react/mui";
import { isTimeInRangeInclusive } from "@lichtblick/rostime";
import Stack from "@lichtblick/suite-base/components/Stack";
import { formatDate, formatTime, getValidatedTimeAndMethodFromString, } from "@lichtblick/suite-base/util/formatTime";
import { formatTimeRaw } from "@lichtblick/suite-base/util/time";
const useStyles = makeStyles()((theme, { timeDisplayMethod }) => ({
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
}));
function PlaybackTimeMethodMenu({ timeFormat, timeRawString, timeOfDayString, setTimeFormat, }) {
    const [anchorEl, setAnchorEl] = useState(undefined);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(undefined);
    };
    return (_jsxs(_Fragment, { children: [_jsx(IconButton, { id: "playback-time-display-toggle-button", "aria-controls": open ? "playback-time-display-toggle-menu" : undefined, "aria-haspopup": "true", "aria-expanded": open ? "true" : undefined, onClick: handleClick, size: "small", children: _jsx(ArrowDropDownIcon, { fontSize: "small" }) }), _jsx(Menu, { id: "playback-time-display-toggle-menu", anchorEl: anchorEl, open: open, onClose: handleClose, MenuListProps: {
                    dense: true,
                    "aria-labelledby": "playback-time-display-toggle-button",
                }, anchorOrigin: {
                    vertical: "top",
                    horizontal: "right",
                }, transformOrigin: {
                    vertical: "bottom",
                    horizontal: "right",
                }, children: [
                    { key: "TOD", label: timeOfDayString ?? "Time of Day" },
                    { key: "SEC", label: timeRawString ?? "Seconds" },
                ].map((option) => (_jsxs(MenuItem, { selected: timeFormat === option.key, onClick: async () => {
                        await setTimeFormat(option.key);
                        handleClose();
                    }, children: [timeFormat === option.key && (_jsx(ListItemIcon, { children: _jsx(CheckIcon, { fontSize: "small" }) })), _jsx(ListItemText, { inset: timeFormat !== option.key, primary: option.label, primaryTypographyProps: { variant: "inherit" } })] }, option.key))) })] }));
}
export function UnconnectedPlaybackTimeDisplay({ appTimeFormat, currentTime, startTime, endTime, timezone, onSeek, onPause, isPlaying, }) {
    const { classes, cx } = useStyles({ timeDisplayMethod: appTimeFormat.timeFormat });
    const timeOutID = useRef(undefined);
    const timeRawString = useMemo(() => (currentTime ? formatTimeRaw(currentTime) : undefined), [currentTime]);
    const timeOfDayString = useMemo(() => currentTime
        ? `${formatDate(currentTime, timezone)} ${formatTime(currentTime, timezone)}`
        : undefined, [currentTime, timezone]);
    const currentTimeString = useMemo(() => (appTimeFormat.timeFormat === "SEC" ? timeRawString : timeOfDayString), [appTimeFormat.timeFormat, timeRawString, timeOfDayString]);
    const [isEditing, setIsEditing] = useState(false);
    const [inputText, setInputText] = useState(currentTimeString ?? undefined);
    const [hasError, setHasError] = useState(false);
    const onSubmit = useCallback((e) => {
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
        if (validTimeAndMethod.time &&
            isTimeInRangeInclusive(validTimeAndMethod.time, startTime, endTime)) {
            onSeek(validTimeAndMethod.time);
            if (validTimeAndMethod.method !== appTimeFormat.timeFormat) {
                void appTimeFormat.setTimeFormat(validTimeAndMethod.method);
            }
        }
    }, [inputText, startTime, currentTime, endTime, timezone, onSeek, appTimeFormat]);
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
    return (_jsx(Stack, { direction: "row", alignItems: "center", flexGrow: 0, gap: 0.5, children: currentTime ? (_jsx("form", { onSubmit: onSubmit, style: { width: "100%" }, children: _jsx(TextField, { className: cx(classes.textField, { [classes.textFieldError]: hasError }), "aria-label": "Playback Time Method", "data-testid": "PlaybackTime-text", value: isEditing ? inputText : currentTimeString, error: hasError, variant: "filled", size: "small", InputProps: {
                    startAdornment: hasError ? _jsx(WarningIcon, { color: "error" }) : undefined,
                    endAdornment: (_jsx(PlaybackTimeMethodMenu, { currentTime,
                        timezone,
                        timeOfDayString,
                        timeRawString,
                        timeFormat: appTimeFormat.timeFormat,
                        setTimeFormat: appTimeFormat.setTimeFormat })),
                }, onFocus: (e) => {
                    onPause();
                    setHasError(false);
                    setIsEditing(true);
                    setInputText(currentTimeString);
                    e.target.select();
                }, onBlur: (e) => {
                    onSubmit(e);
                    setIsEditing(false);
                    timeOutID.current = setTimeout(() => {
                        setHasError(false);
                    }, 600);
                }, onChange: (event) => {
                    setInputText(event.target.value);
                } }) })) : (_jsx(TextField, { className: cx(classes.textField, "Mui-disabled"), disabled: true, variant: "filled", size: "small", defaultValue: appTimeFormat.timeFormat === "SEC" ? "0000000000.000000000" : "0000-00-00 00:00:00.000", InputProps: {
                endAdornment: (_jsx(IconButton, { edge: "end", size: "small", disabled: true, children: _jsx(ArrowDropDownIcon, { fontSize: "small" }) })),
            } })) }));
}
