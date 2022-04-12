// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { IconButton, TextFieldProps, TextField, styled as muiStyled } from "@mui/material";
import { ReactNode } from "react";
import { useKeyPress } from "react-use";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const StyledTextField = muiStyled(TextField)({
  ".MuiInputBase-formControl.MuiInputBase-root": {
    paddingTop: 0,
    paddingBottom: 0,
  },
  ".MuiInputBase-input": {
    textAlign: "center",
    fontFamily: fonts.MONOSPACE,

    "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
      appearance: "none",
      margin: 0,
    },
  },
  "@media (pointer: fine)": {
    ".MuiIconButton-root": {
      visibility: "hidden",
    },
    "&:hover .MuiIconButton-root": {
      visibility: "visible",
    },
  },
});

const StyledIconButton = muiStyled(IconButton)(({ theme }) => ({
  "&.MuiIconButton-edgeStart": {
    marginLeft: theme.spacing(-0.75),
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  "&.MuiIconButton-edgeEnd": {
    marginRight: theme.spacing(-0.75),
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
}));

export function NumberInput(
  props: {
    iconUp?: ReactNode;
    iconDown?: ReactNode;
    step?: number;
    value?: number;
    onChange: (value: undefined | number) => void;
  } & Omit<TextFieldProps, "onChange">,
): JSX.Element {
  const { value, iconDown, iconUp, step = 1, onChange } = props;

  const [shiftPressed] = useKeyPress("Shift");

  const stepAmount = shiftPressed ? step * 10 : step;

  return (
    <StyledTextField
      {...props}
      value={value}
      onChange={(event) =>
        onChange(event.target.value.length > 0 ? Number(event.target.value) : undefined)
      }
      type="number"
      InputProps={{
        startAdornment: (
          <StyledIconButton
            size="small"
            edge="start"
            onClick={() => value != undefined && onChange(value - stepAmount)}
          >
            {iconDown ?? <ChevronLeftIcon fontSize="small" />}
          </StyledIconButton>
        ),
        endAdornment: (
          <StyledIconButton
            size="small"
            edge="end"
            onClick={() => value != undefined && onChange(value + stepAmount)}
          >
            {iconUp ?? <ChevronRightIcon fontSize="small" />}
          </StyledIconButton>
        ),
      }}
    />
  );
}
