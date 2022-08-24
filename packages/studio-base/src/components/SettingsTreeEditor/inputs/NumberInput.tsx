// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { IconButton, TextFieldProps, TextField, styled as muiStyled } from "@mui/material";
import { clamp, isFinite } from "lodash";
import { ReactNode, useCallback } from "react";

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

function limitPrecision(x: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(x * factor) / factor;
}

export function NumberInput(
  props: {
    iconUp?: ReactNode;
    iconDown?: ReactNode;
    max?: number;
    min?: number;
    precision?: number;
    readOnly?: boolean;
    step?: number;
    value?: number;
    onChange: (value: undefined | number) => void;
  } & Omit<TextFieldProps, "onChange">,
): JSX.Element {
  const { value, iconDown, iconUp, step = 1, onChange, disabled, readOnly } = props;

  const placeHolderValue = isFinite(Number(props.placeholder))
    ? Number(props.placeholder)
    : undefined;

  const updateValue = useCallback(
    (newValue: undefined | number) => {
      if (disabled === true || readOnly === true) {
        return;
      }

      const clampedValue =
        newValue == undefined
          ? undefined
          : clamp(
              newValue,
              props.min ?? Number.NEGATIVE_INFINITY,
              props.max ?? Number.POSITIVE_INFINITY,
            );
      const newLimitedValue =
        props.precision != undefined && clampedValue != undefined
          ? limitPrecision(clampedValue, props.precision)
          : clampedValue;
      onChange(newLimitedValue);
    },
    [disabled, readOnly, props.min, props.max, props.precision, onChange],
  );

  const limitedValue =
    props.precision != undefined && value != undefined
      ? limitPrecision(value, props.precision)
      : value;

  return (
    <StyledTextField
      {...props}
      value={limitedValue ?? ""}
      onChange={(event) =>
        updateValue(event.target.value.length > 0 ? Number(event.target.value) : undefined)
      }
      type="number"
      inputProps={{ max: props.max, min: props.min, step }}
      InputProps={{
        readOnly,
        startAdornment: (
          <StyledIconButton
            size="small"
            edge="start"
            onClick={(event: React.MouseEvent) =>
              updateValue((value ?? placeHolderValue ?? 0) - (event.shiftKey ? step * 10 : step))
            }
          >
            {iconDown ?? <ChevronLeftIcon fontSize="small" />}
          </StyledIconButton>
        ),
        endAdornment: (
          <StyledIconButton
            size="small"
            edge="end"
            onClick={(event: React.MouseEvent) =>
              updateValue((value ?? placeHolderValue ?? 0) + (event.shiftKey ? step * 10 : step))
            }
          >
            {iconUp ?? <ChevronRightIcon fontSize="small" />}
          </StyledIconButton>
        ),
      }}
    />
  );
}
