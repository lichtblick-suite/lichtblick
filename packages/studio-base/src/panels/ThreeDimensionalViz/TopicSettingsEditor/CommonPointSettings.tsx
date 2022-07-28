// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  FormControl,
  FormLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from "@mui/material";

export default function CommonPointSettings({
  defaultPointSize,
  defaultPointShape = "circle",
  settings,
  onFieldChange,
}: {
  defaultPointSize: number;
  defaultPointShape?: string;
  settings: {
    pointSize?: number;
    pointShape?: string;
  };
  onFieldChange: (name: string, value: unknown) => void;
}): JSX.Element {
  const pointSizeVal = settings.pointSize == undefined ? "" : settings.pointSize;

  const pointShape = settings.pointShape;
  const pointShapeVal = pointShape ?? defaultPointShape;

  return (
    <Stack flex="auto" gap={1}>
      <TextField
        label="Point size"
        data-testid="point-size-input"
        type="number"
        placeholder={defaultPointSize.toString()}
        value={pointSizeVal}
        variant="filled"
        inputProps={{
          min: 1,
          max: 50,
          step: 1,
        }}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("pointSize", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />

      <FormControl>
        <FormLabel id="point-shape-label">Point shape</FormLabel>
        <Select
          id="point-shape-select"
          labelId="point-shape-label"
          value={pointShapeVal}
          onChange={(event: SelectChangeEvent) => onFieldChange("pointShape", event.target.value)}
          variant="filled"
          MenuProps={{
            disablePortal: true,
            MenuListProps: {
              dense: true,
            },
          }}
        >
          <MenuItem value="circle">Circle</MenuItem>
          <MenuItem value="square">Square</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}
