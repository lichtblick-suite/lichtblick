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

import { Stack } from "@mui/material";

import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import { Color } from "@foxglove/studio-base/types/Messages";

import { TopicSettingsEditorProps } from ".";
import { SLabel, SInput } from "./common";

export type PoseSettings = {
  overrideColor?: Color;
  alpha?: number;
  size?: {
    shaftLength?: number;
    headLength?: number;
    headWidth?: number;
    shaftWidth?: number;
  };
};

export default function PoseSettingsEditor(
  props: TopicSettingsEditorProps<unknown, PoseSettings>,
): JSX.Element {
  const { settings, onFieldChange, onSettingsChange } = props;

  const currentLength = settings.size?.shaftLength ?? 1;
  const currentShaftWidth = settings.size?.shaftWidth ?? 0.05;
  const currentHeadWidth = settings.size?.headWidth ?? 0.2;
  const currentHeadLength = settings.size?.headLength ?? 0.3;

  return (
    <Stack flex="auto">
      <SLabel>Color</SLabel>
      <ColorPicker
        color={settings.overrideColor}
        onChange={(newColor) => onFieldChange("overrideColor", newColor)}
        alphaType="alpha"
      />
      <SLabel>Shaft length</SLabel>
      <SInput
        type="number"
        value={currentLength}
        placeholder="2"
        onChange={(e) =>
          onSettingsChange({
            ...settings,
            size: { ...settings.size, shaftLength: parseFloat(e.target.value) },
          })
        }
      />
      <SLabel>Shaft width</SLabel>
      <SInput
        type="number"
        value={currentShaftWidth}
        placeholder="2"
        onChange={(e) =>
          onSettingsChange({
            ...settings,
            size: { ...settings.size, shaftWidth: parseFloat(e.target.value) },
          })
        }
      />
      <SLabel>Head width</SLabel>
      <SInput
        type="number"
        value={currentHeadWidth}
        placeholder="2"
        onChange={(e) =>
          onSettingsChange({
            ...settings,
            size: { ...settings.size, headWidth: parseFloat(e.target.value) },
          })
        }
      />
      <SLabel>Head length</SLabel>
      <SInput
        type="number"
        value={currentHeadLength}
        placeholder="0.1"
        onChange={(e) =>
          onSettingsChange({
            ...settings,
            size: { ...settings.size, headLength: parseFloat(e.target.value) },
          })
        }
      />
    </Stack>
  );
}

PoseSettingsEditor.canEditNamespaceOverrideColor = true;
