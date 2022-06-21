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

import { Checkbox, FormControl, FormControlLabel, FormHelperText, Stack } from "@mui/material";

import { Marker, MarkerArray } from "@foxglove/studio-base/types/Messages";

import { TopicSettingsEditorProps } from ".";

type GenericSettings = {
  frameLocked?: boolean;
};

export default function OccupancyGridSettingsEditor(
  props: TopicSettingsEditorProps<Marker | MarkerArray, GenericSettings>,
): JSX.Element {
  const { settings = {}, onFieldChange } = props;
  return (
    <Stack flex="auto">
      <FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={settings.frameLocked === true}
              onChange={(_ev, checked) => onFieldChange("frameLocked", checked)}
            />
          }
          label="Frame lock"
        />
        <FormHelperText variant="standard">
          When disabled, the grid will be positioned in the 3D scene by transforming it using its{" "}
          <code>header.stamp</code> time. When enabled, the grid will be “locked” to the current
          position of its <code>header.frame_id</code> and will move when the frame moves.
        </FormHelperText>
      </FormControl>
    </Stack>
  );
}
