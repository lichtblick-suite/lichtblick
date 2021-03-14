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

import { Color } from "regl-worldview";

import ColorPickerForTopicSettings from "./ColorPickerForTopicSettings";
import CommonDecaySettings from "./CommonDecaySettings";
import CommonPointSettings from "./CommonPointSettings";
import { SLabel } from "./common";
import { TopicSettingsEditorProps } from "./types";
import Flex from "@foxglove-studio/app/components/Flex";
import { LaserScan } from "@foxglove-studio/app/types/Messages";

type LaserScanSettings = {
  pointSize?: number;
  pointShape?: string;
  decayTime?: number;
  overrideColor?: Color;
};

export default function LaserScanSettingsEditor(
  props: TopicSettingsEditorProps<LaserScan, LaserScanSettings>,
) {
  const { settings, onFieldChange } = props;

  return (
    <Flex col>
      <CommonPointSettings
        settings={settings}
        defaultPointSize={4}
        defaultPointShape="square"
        onFieldChange={onFieldChange}
      />
      <CommonDecaySettings settings={settings} onFieldChange={onFieldChange} />

      <SLabel>Color</SLabel>
      <ColorPickerForTopicSettings
        color={settings.overrideColor}
        onChange={(newColor) => onFieldChange("overrideColor", newColor)}
      />
    </Flex>
  );
}
