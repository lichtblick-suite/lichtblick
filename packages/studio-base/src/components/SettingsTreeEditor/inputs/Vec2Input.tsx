// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

import { NumberInput } from "./NumberInput";

type Vec2Props = {
  disabled?: boolean;
  onChange: (value: undefined | [undefined | number, undefined | number]) => void;
  precision?: number;
  readOnly?: boolean;
  step?: number;
  placeholder?: readonly [undefined | string, undefined | string];
  value: undefined | readonly [undefined | number, undefined | number];
  min?: number;
  max?: number;
};

export function Vec2Input(props: Vec2Props): JSX.Element {
  const {
    disabled = false,
    onChange,
    precision,
    readOnly = false,
    step,
    value,
    min,
    max,
    placeholder,
  } = props;

  const onChangeCallback = useCallback(
    (position: number, inputValue: undefined | number) => {
      const newValue: [undefined | number, undefined | number] = [...(value ?? [0, 0])];
      newValue[position] = inputValue;
      onChange(newValue);
    },
    [onChange, value],
  );

  return (
    <Stack gap={0.25}>
      <NumberInput
        size="small"
        disabled={disabled}
        readOnly={readOnly}
        variant="filled"
        fullWidth
        precision={precision}
        step={step}
        placeholder={placeholder?.[0]}
        value={value?.[0]}
        min={min}
        max={max}
        onChange={(newValue) => {
          onChangeCallback(0, newValue);
        }}
      />
      <NumberInput
        size="small"
        disabled={disabled}
        readOnly={readOnly}
        variant="filled"
        fullWidth
        precision={precision}
        step={step}
        placeholder={placeholder?.[1]}
        value={value?.[1]}
        min={min}
        max={max}
        onChange={(newValue) => {
          onChangeCallback(1, newValue);
        }}
      />
    </Stack>
  );
}
