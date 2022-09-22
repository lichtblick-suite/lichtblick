// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import { TextField, Popover, IconButton } from "@mui/material";
import { useCallback, MouseEvent, useState, useMemo } from "react";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { ColorPickerControl } from "./ColorPickerControl";
import { ColorSwatch } from "./ColorSwatch";

const useStyles = makeStyles()({
  root: {
    position: "relative",
  },
  rootDisabled: {
    pointerEvents: "none",
  },
  textField: {
    ".MuiInputBase-formControl.MuiInputBase-root": {
      padding: 0,
    },
    ".MuiInputBase-root": {
      cursor: "pointer",
    },
    ".MuiInputBase-input": {
      fontFamily: fonts.MONOSPACE,
      alignItems: "center",
    },
  },
});

type ColorPickerInputProps = {
  alphaType: "none" | "alpha";
  disabled?: boolean;
  value: undefined | string;
  onChange: (value: undefined | string) => void;
  placeholder?: string;
  readOnly?: boolean;
};

export function ColorPickerInput(props: ColorPickerInputProps): JSX.Element {
  const { alphaType, disabled, onChange, readOnly, value } = props;

  const { classes, cx } = useStyles();

  const [anchorElement, setAnchorElement] = useState<undefined | HTMLDivElement>(undefined);

  const parsedValue = useMemo(() => (value ? tinycolor(value) : undefined), [value]);
  const displayValue =
    alphaType === "alpha" ? parsedValue?.toHex8String() : parsedValue?.toHexString();
  const swatchColor = displayValue ?? "#00000044";

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

  return (
    <Stack
      className={cx(classes.root, {
        [classes.rootDisabled]: disabled === true || readOnly === true,
      })}
    >
      <TextField
        className={classes.textField}
        fullWidth
        disabled={disabled}
        placeholder={props.placeholder}
        size="small"
        value={displayValue ?? ""}
        variant="filled"
        InputProps={{
          readOnly: true,
          startAdornment: <ColorSwatch color={swatchColor} onClick={handleClick} />,
          endAdornment: (
            <IconButton onClick={clearValue} size="small" disabled={disabled}>
              <ClearIcon />
            </IconButton>
          ),
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
        <ColorPickerControl alphaType={alphaType} value={value} onChange={onChange} />
      </Popover>
    </Stack>
  );
}
