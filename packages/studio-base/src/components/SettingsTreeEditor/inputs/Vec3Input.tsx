// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

import { NumberInput } from "./NumberInput";

export function Vec3Input({
  disabled = false,
  onChange,
  precision,
  readOnly = false,
  step,
  value,
  min,
  max,
}: {
  disabled?: boolean;
  onChange: (
    value: undefined | [undefined | number, undefined | number, undefined | number],
  ) => void;
  precision?: number;
  readOnly?: boolean;
  step?: number;
  value: undefined | readonly [undefined | number, undefined | number, undefined | number];
  min?: number;
  max?: number;
}): JSX.Element {
  const onChangeCallback = useCallback(
    (position: number, inputValue: undefined | number) => {
      const newValue: [undefined | number, undefined | number, undefined | number] = [
        ...(value ?? [0, 0, 0]),
      ];
      newValue[position] = inputValue;
      onChange(newValue);
    },
    [onChange, value],
  );

  if (value == undefined) {
    return <div />;
  }

  return (
    <Stack gap={0.25}>
      {value.map((pval, position) => (
        <NumberInput
          key={position}
          size="small"
          disabled={disabled}
          readOnly={readOnly}
          variant="filled"
          fullWidth
          precision={precision}
          step={step}
          value={pval}
          min={min}
          max={max}
          onChange={(newValue) => onChangeCallback(position, newValue)}
        />
      ))}
    </Stack>
  );
}
