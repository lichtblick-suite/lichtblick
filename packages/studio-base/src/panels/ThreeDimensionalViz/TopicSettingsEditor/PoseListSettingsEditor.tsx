// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Stack, Radio, FormControlLabel, RadioGroup, FormLabel, FormControl } from "@mui/material";

import { TopicSettingsEditorProps } from ".";
import PoseSettingsEditor, { PoseSettings } from "./PoseSettingsEditor";
import { SInput, SLabel } from "./common";

export type PoseListSettings = PoseSettings & {
  displayType?: "arrows" | "line";
  lineThickness?: number;
};

export default function PoseListSettingsEditor(
  props: TopicSettingsEditorProps<unknown, PoseListSettings>,
): JSX.Element {
  const { settings, onFieldChange } = props;

  const { displayType = "arrows", lineThickness = 0.2 } = settings;

  return (
    <Stack flex="auto">
      <FormControl>
        <FormLabel id="pose-display-radio-buttons-group">Display poses as</FormLabel>
        <RadioGroup
          aria-labelledby="pose-display-radio-buttons-group"
          defaultValue={displayType}
          onChange={(_event, value) => onFieldChange("displayType", value)}
        >
          <FormControlLabel value="arrows" label="Arrows" control={<Radio />} />
          <FormControlLabel value="line" label="Lise" control={<Radio />} />
        </RadioGroup>
      </FormControl>
      {displayType === "line" && (
        <>
          <SLabel>Line thickness</SLabel>
          <SInput
            type="number"
            value={lineThickness}
            placeholder="2"
            onChange={(e) => onFieldChange("lineThickness", parseFloat(e.target.value))}
          />
        </>
      )}
      {displayType === "arrows" && <PoseSettingsEditor {...props} />}
    </Stack>
  );
}
