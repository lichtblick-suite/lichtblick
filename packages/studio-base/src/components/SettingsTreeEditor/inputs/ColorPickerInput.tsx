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
  ".MuiInputBase-input": {
    fontFamily: fonts.MONOSPACE,
    alignItems: "center",
  },
});

const Root = muiStyled("div")({
  position: "relative",
});

type ColorPickerInputProps = {
  alphaType: "none" | "alpha";
  value: undefined | string;
  onChange: (value: undefined | string) => void;
  placeholder?: string;
  swatchOrientation?: "start" | "end";
};

export function ColorPickerInput(props: ColorPickerInputProps): JSX.Element {
  const { onChange, swatchOrientation = "start", value } = props;

  const [anchorElement, setAnchorElement] = useState<undefined | HTMLDivElement>(undefined);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    setAnchorElement(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorElement(undefined);
  }, []);

  const open = Boolean(anchorElement);

  const isValidColor = value != undefined && tinycolor(value).isValid();
  const swatchColor = isValidColor ? value : "#00000044";

  return (
    <Root>
      <StyledTextField
        fullWidth
        onChange={(event) => onChange(event.target.value)}
        placeholder={props.placeholder}
        size="small"
        value={value}
        variant="filled"
        InputProps={{
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
                fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero'`,
              },
            },
          }}
          onChange={(_event, newValue) => onChange(newValue.str)}
        />
      </Popover>
    </Root>
  );
}
