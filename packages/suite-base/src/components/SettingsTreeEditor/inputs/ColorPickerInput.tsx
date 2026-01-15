// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CancelIcon from "@mui/icons-material/Cancel";
import { TextField, Popover, IconButton, inputBaseClasses, Tooltip } from "@mui/material";
import { useCallback, MouseEvent, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@lichtblick/suite-base/components/Stack";
import { customTypography } from "@lichtblick/theme";

import { ColorPickerControl, useColorPickerControl } from "./ColorPickerControl";
import { ColorSwatch } from "./ColorSwatch";

const useStyles = makeStyles<void, "iconButton">()((theme, _params, classes) => ({
  root: {
    position: "relative",
  },
  rootDisabled: {
    pointerEvents: "none",
  },
  textField: {
    [`.${inputBaseClasses.formControl}.${inputBaseClasses.root}`]: {
      padding: 0,
    },
    [`.${inputBaseClasses.root}`]: {
      fontFamily: customTypography.fontMonospace,
      cursor: "pointer",

      [`:not(:hover) .${classes.iconButton}`]: {
        visibility: "hidden",
      },
    },
    [`.${inputBaseClasses.input}`]: {
      alignItems: "center",
      fontFeatureSettings: `${customTypography.fontFeatureSettings}, "zero"`,
    },
  },
  iconButton: {
    marginRight: theme.spacing(0.25),
    opacity: theme.palette.action.disabledOpacity,

    ":hover": {
      background: "transparent",
      opacity: 1,
    },
  },
  colorSwatch: {
    marginLeft: theme.spacing(0.75),
  },
}));

type ColorPickerInputProps = {
  alphaType: "none" | "alpha";
  disabled?: boolean;
  value: undefined | string;
  onChange: (value: undefined | string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hideClearButton?: boolean;
};

export function ColorPickerInput(props: ColorPickerInputProps): React.JSX.Element {
  const { alphaType, disabled, onChange, readOnly, hideClearButton, value } = props;
  const { classes, cx } = useStyles();

  const {
    swatchColor,
    displayValue,
    updatePrefixedColor,
    editedValueIsInvalid,
    editedValue,
    updateEditedValue,
    onInputBlur,
  } = useColorPickerControl({
    alphaType,
    onChange,
    value,
  });

  const [anchorElement, setAnchorElement] = useState<undefined | HTMLDivElement>(undefined);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    setAnchorElement(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorElement(undefined);
  }, []);

  const clearValue = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const open = Boolean(anchorElement);

  const shouldHideClearButton = (displayValue ?? "") === "" || (hideClearButton ?? false);
  return (
    <Stack
      className={cx(classes.root, {
        [classes.rootDisabled]: disabled === true || readOnly === true,
      })}
    >
      <TextField
        data-testid="ColorPickerInput"
        className={classes.textField}
        fullWidth
        disabled={disabled}
        placeholder={props.placeholder}
        size="small"
        variant="filled"
        value={editedValue ? `#${editedValue.replace("#", "")}` : editedValue}
        onKeyDown={(event) => event.key === "Enter" && handleClose}
        onChange={(event) => {
          updateEditedValue(event.target.value);
        }}
        onBlur={onInputBlur}
        slotProps={{
          input: {
            onFocus: (event) => {
              event.target.select();
            },
            // readOnly: true,
            startAdornment: (
              <ColorSwatch
                className={classes.colorSwatch}
                color={swatchColor}
                onClick={handleClick}
                size="small"
              />
            ),
            endAdornment: !shouldHideClearButton && (
              <Tooltip title="Reset to default">
                <IconButton
                  size="small"
                  className={classes.iconButton}
                  onClick={clearValue}
                  disabled={disabled}
                >
                  <CancelIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            ),
          },
        }}
      />
      <Popover
        open={open}
        anchorEl={anchorElement}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <ColorPickerControl
          alphaType={alphaType}
          onChange={onChange}
          onEnterKey={handleClose}
          swatchColor={swatchColor}
          updatePrefixedColor={updatePrefixedColor}
          editedValueIsInvalid={editedValueIsInvalid}
          editedValue={editedValue}
          updateEditedValue={updateEditedValue}
          onInputBlur={onInputBlur}
        />
      </Popover>
    </Stack>
  );
}
