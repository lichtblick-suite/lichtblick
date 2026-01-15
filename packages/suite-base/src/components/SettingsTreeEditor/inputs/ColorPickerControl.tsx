// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import TagIcon from "@mui/icons-material/Tag";
import { TextField } from "@mui/material";
import { useCallback, useState, useMemo } from "react";
import { HexAlphaColorPicker, HexColorPicker } from "react-colorful";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";
import { useDebouncedCallback } from "use-debounce";

import Stack from "@lichtblick/suite-base/components/Stack";
import { customTypography } from "@lichtblick/theme";

const useStyles = makeStyles()((theme) => ({
  picker: {
    "&.react-colorful": {
      width: "100%",
      gap: theme.spacing(0.25),
    },
    ".react-colorful__saturation": {
      borderBottom: 0,
    },
    ".react-colorful__saturation, .react-colorful__hue, .react-colorful__alpha": {
      borderRadius: theme.shape.borderRadius,
    },
    ".react-colorful__hue": {
      order: -1,
    },
    ".react-colorful__hue-pointer, .react-colorful__alpha-pointer": {
      width: theme.spacing(1),
      borderRadius: theme.shape.borderRadius,
    },
    ".react-colorful__hue-pointer": {
      zIndex: 4,
    },
    ".react-colorful__saturation-pointer": {
      width: theme.spacing(2),
      height: theme.spacing(2),
    },
  },
}));

type ColorPickerProps = {
  value: undefined | string;
  alphaType: "none" | "alpha";
  onChange: (value: string) => void;
};

type ColorPickerInputProps = {
  onEnterKey?: () => void;
  swatchColor: string;
  updatePrefixedColor: (newValue: string) => void;
  editedValueIsInvalid: boolean;
  editedValue: string;
  updateEditedValue: (newValue: string) => void;
  onInputBlur: () => void;
} & Omit<ColorPickerProps, "value">;

export function ColorPickerControl(props: ColorPickerInputProps): React.JSX.Element {
  const {
    alphaType,
    onChange,
    onEnterKey,
    swatchColor,
    updatePrefixedColor,
    editedValueIsInvalid,
    editedValue,
    updateEditedValue,
    onInputBlur,
  } = props;

  const { classes } = useStyles();

  return (
    <Stack padding={1.5} gap={1}>
      {alphaType === "alpha" ? (
        <HexAlphaColorPicker
          className={classes.picker}
          color={swatchColor}
          onChange={updatePrefixedColor}
        />
      ) : (
        <HexColorPicker
          className={classes.picker}
          color={swatchColor}
          onChange={updatePrefixedColor}
        />
      )}
      <TextField
        size="small"
        error={editedValueIsInvalid}
        slotProps={{
          input: {
            onFocus: (event) => {
              event.target.select();
            },
            role: "input",
            startAdornment: <TagIcon fontSize="small" />,
            style: { fontFamily: customTypography.fontMonospace },
          },
        }}
        placeholder={alphaType === "alpha" ? "RRGGBBAA" : "RRGGBB"}
        value={editedValue}
        onKeyDown={(event) => event.key === "Enter" && onEnterKey?.()}
        onChange={(event) => {
          onChange(event.target.value);
          updateEditedValue(event.target.value);
        }}
        onBlur={onInputBlur}
      />
    </Stack>
  );
}

const hexMatcher = /^#?([0-9A-F]{3,8})$/i;
function isValidHexColor(color: string, alphaType: "none" | "alpha") {
  const match = hexMatcher.exec(color);
  const length = match?.[1]?.length ?? 0;

  // 3 and 6 are always valid color values
  // 4 and 8 are valid only if using alpha
  return length === 3 || length === 6 || (alphaType === "alpha" && (length === 4 || length === 8));
}

// Internal business logic hook for ColorPickerControl
//
// Exported for tests and we disable the eslint requirement to specify a return value because this
// hook is considered "internal" and we are ok inferring the return type
//
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useColorPickerControl(props: ColorPickerProps) {
  const { alphaType, onChange, value } = props;

  const parsedValue = useMemo(() => (value ? tinycolor(value) : undefined), [value]);
  const hex = alphaType === "alpha" ? parsedValue?.toHex8() : parsedValue?.toHex();
  const displayValue =
    alphaType === "alpha" ? parsedValue?.toHex8String() : parsedValue?.toHexString();
  const swatchColor = displayValue ?? "#00000044";

  const [editedValue, setEditedValue] = useState(hex ?? "");

  const editedValueIsInvalid = editedValue.length > 0 && !isValidHexColor(editedValue, alphaType);

  const updateColor = useDebouncedCallback((newValue: string) => {
    onChange(`#${newValue}`);
    setEditedValue(newValue);
  });

  // HexColorPicker onChange provides a leading `#` for values and updateColor needs
  // un-prefixed values so it can update the edited field
  const updatePrefixedColor = useCallback(
    (newValue: string) => {
      const parsed = tinycolor(newValue);
      updateColor(alphaType === "alpha" ? parsed.toHex8() : parsed.toHex());
    },
    [alphaType, updateColor],
  );

  const updateEditedValue = useCallback(
    (newValue: string) => {
      setEditedValue(newValue);

      // if it is a valid color then we can emit the new value
      if (isValidHexColor(newValue, alphaType)) {
        const parsed = tinycolor(newValue);
        const settingValue = alphaType === "alpha" ? parsed.toHex8String() : parsed.toHexString();
        onChange(settingValue);
      }
    },
    [alphaType, onChange],
  );

  // When the input blurs we update the edited value to the latest input value to show the user
  // the expanded form that is the actual setting value.
  const onInputBlur = useCallback(() => {
    setEditedValue(hex ?? "");
  }, [hex]);

  return {
    alphaType,
    swatchColor,
    displayValue,
    updatePrefixedColor,
    editedValueIsInvalid,
    editedValue,
    updateEditedValue,
    onInputBlur,
    onChange,
  };
}
