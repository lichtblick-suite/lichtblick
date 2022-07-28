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

import { FormControl, FormLabel, Stack, TextField } from "@mui/material";

import { Color } from "@foxglove/regl-worldview";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";

import { TopicSettingsEditorProps } from ".";

export type GridSettings = {
  overrideColor?: Color;
  width?: number;
  subdivisions?: number;
  heightOffset?: number;
};

export const DEFAULT_GRID_COLOR: Color = { r: 36 / 255, g: 142 / 255, b: 255 / 255, a: 1 };

export default function GridSettingsEditor(
  props: TopicSettingsEditorProps<undefined, GridSettings>,
): React.ReactElement {
  const { settings = {}, onFieldChange } = props;

  return (
    <Stack flex="auto" gap={1}>
      <FormControl>
        <FormLabel>Color</FormLabel>
        <ColorPicker
          color={settings.overrideColor ?? DEFAULT_GRID_COLOR}
          onChange={(newColor) => onFieldChange("overrideColor", newColor)}
        />
      </FormControl>
      <TextField
        label="Width"
        variant="filled"
        data-testid="width-input"
        type="number"
        placeholder="10"
        value={settings.width ?? ""}
        inputProps={{ min: 1, max: 1000, step: 1 }}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("width", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />
      <TextField
        label="Subdivisions"
        variant="filled"
        data-testid="subdivisions-input"
        type="number"
        placeholder="9"
        value={settings.subdivisions ?? ""}
        inputProps={{ min: 0, max: 1000, step: 1 }}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("subdivisions", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />
      <TextField
        label="Height offset"
        variant="filled"
        data-testid="height-offset-input"
        type="number"
        placeholder="0"
        value={settings.heightOffset ?? ""}
        inputProps={{ min: -1000, max: 1000, step: 0.1 }}
        onChange={(e) => {
          const isInputValid = !isNaN(parseFloat(e.target.value));
          onFieldChange("heightOffset", isInputValid ? parseFloat(e.target.value) : undefined);
        }}
      />
    </Stack>
  );
}
