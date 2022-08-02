// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ColorPicker } from "@fluentui/react";
import { TextField, styled as muiStyled, Popover } from "@mui/material";
import { useCallback, MouseEvent, useState } from "react";
import tinycolor from "tinycolor2";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { ColorSwatch } from "./ColorSwatch";

const StyledTextField = muiStyled(TextField)({
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
});

const Root = muiStyled("div", { shouldForwardProp: (prop) => prop !== "disabled" })<{
  disabled: boolean;
}>(({ disabled }) => ({
  position: "relative",
  pointerEvents: disabled ? "none" : "auto",
}));

type ColorPickerInputProps = {
  alphaType: "none" | "alpha";
  disabled?: boolean;
  value: undefined | string;
  onChange: (value: undefined | string) => void;
  placeholder?: string;
  swatchOrientation?: "start" | "end";
  readOnly?: boolean;
};

export function ColorPickerInput(props: ColorPickerInputProps): JSX.Element {
  const { alphaType, disabled, onChange, readOnly, swatchOrientation = "start", value } = props;

  const [anchorElement, setAnchorElement] = useState<undefined | HTMLDivElement>(undefined);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    setAnchorElement(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorElement(undefined);
  }, []);

  const open = Boolean(anchorElement);

  const parsedValue = value ? tinycolor(value) : undefined;
  const displayValue =
    alphaType === "alpha" ? parsedValue?.toHex8String() : parsedValue?.toHexString();
  const swatchColor = displayValue ?? "#00000044";

  return (
    <Root disabled={disabled === true || readOnly === true}>
      <StyledTextField
        fullWidth
        disabled={disabled}
        placeholder={props.placeholder}
        size="small"
        value={displayValue}
        variant="filled"
        InputProps={{
          readOnly: true,
          startAdornment: swatchOrientation === "start" && (
            <ColorSwatch color={swatchColor} onClick={handleClick} />
          ),
          endAdornment: swatchOrientation === "end" && (
            <ColorSwatch color={swatchColor} onClick={handleClick} />
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
        <ColorPicker
          color={swatchColor}
          alphaType={props.alphaType}
          styles={{
            root: { minWidth: 216 },
            tableHexCell: { width: "35%" },
            input: {
              input: {
                fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero' !important`,
              },
            },
          }}
          onChange={(_event, newValue) => onChange(newValue.str)}
        />
      </Popover>
    </Root>
  );
}
