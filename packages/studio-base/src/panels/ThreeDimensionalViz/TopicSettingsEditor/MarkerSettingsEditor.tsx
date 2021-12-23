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

import { Color } from "@foxglove/regl-worldview";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import Flex from "@foxglove/studio-base/components/Flex";
import { Marker, MarkerArray } from "@foxglove/studio-base/types/Messages";

import { TopicSettingsEditorProps } from ".";
import { SLabel, SDescription } from "./common";

type MarkerSettings = {
  overrideColor?: Color;
};

export default function MarkerSettingsEditor(
  props: TopicSettingsEditorProps<Marker | MarkerArray, MarkerSettings>,
): JSX.Element {
  const { settings = {}, onFieldChange } = props;
  return (
    <Flex col>
      <SLabel>Color</SLabel>
      <SDescription>
        Overrides <code>color</code>/<code>colors</code> for all markers on this topic.
      </SDescription>
      <ColorPicker
        color={settings.overrideColor}
        onChange={(newColor) => onFieldChange("overrideColor", newColor)}
      />
    </Flex>
  );
}

MarkerSettingsEditor.canEditNamespaceOverrideColor = true;
