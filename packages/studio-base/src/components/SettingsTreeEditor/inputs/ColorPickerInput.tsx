// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ColorPicker } from "@fluentui/react";
import {
  Card,
  TextField,
  styled as muiStyled,
  TextFieldProps,
  ClickAwayListener,
} from "@mui/material";
import { useState } from "react";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const StyledTextField = muiStyled(TextField)({
  ".MuiInputBase-formControl.MuiInputBase-root": {
    padding: 0,
  },
  ".MuiInputBase-input": {
    fontFamily: fonts.MONOSPACE,
    alignItems: "center",
  },
});

const ColorSwatch = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "color",
})<{ color: string }>(({ theme, color }) => ({
  backgroundColor: color,
  height: theme.spacing(2.5),
  width: theme.spacing(3),
  margin: theme.spacing(0.625),
  borderRadius: 1,
  border: `1px solid ${theme.palette.getContrastText(color)}`,
}));

const Root = muiStyled("div")({
  position: "relative",
});

const PickerWrapper = muiStyled(Card)(({ theme }) => ({
  position: "absolute",
  zIndex: theme.zIndex.modal,
}));

type ColorPickerInputProps = {
  value: undefined | string;
  onChange: (value: undefined | string) => void;
  swatchOrientation?: "start" | "end";
} & Omit<TextFieldProps, "onChange">;

export function ColorPickerInput(props: ColorPickerInputProps): JSX.Element {
  const { onChange, swatchOrientation = "start", value } = props;
  const [showPicker, setShowPicker] = useState(false);

  const isValidColor = Boolean(value?.match(/^#[0-9a-fA-F]{6}$/i));
  const swatchColor = isValidColor && value != undefined ? value : "#00000044";

  const togglePicker = () => setShowPicker(!showPicker);

  return (
    <Root>
      <StyledTextField
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        InputProps={{
          startAdornment: swatchOrientation === "start" && (
            <ColorSwatch color={swatchColor} onClick={togglePicker} />
          ),
          endAdornment: swatchOrientation === "end" && (
            <ColorSwatch color={swatchColor} onClick={togglePicker} />
          ),
        }}
      />
      {showPicker && (
        <ClickAwayListener onClickAway={() => setShowPicker(false)}>
          <PickerWrapper variant="elevation">
            <ColorPicker
              color={swatchColor}
              alphaType={"none"}
              styles={{
                tableHexCell: { width: "35%" },
                input: {
                  input: {
                    fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero'`,
                  },
                },
              }}
              onChange={(_event, newValue) => onChange(newValue.str)}
            />
          </PickerWrapper>
        </ClickAwayListener>
      )}
    </Root>
  );
}
