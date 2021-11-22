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

import Flex from "@foxglove/studio-base/components/Flex";

import { TopicSettingsEditorProps } from ".";
import { SLabel, SDescription, SInput } from "./common";

export type UrdfSettings = {
  urdfUrl?: string;
};

export default function UrdfSettingsEditor(
  props: TopicSettingsEditorProps<undefined, UrdfSettings>,
): React.ReactElement {
  const { settings = {}, onFieldChange } = props;

  return (
    <Flex col>
      <SLabel>URDF Location</SLabel>
      <SDescription>
        package:// URL or http(s) URL pointing to a Unified Robot Description Format (URDF) XML file
      </SDescription>
      <SInput
        type="text"
        value={settings.urdfUrl ?? ""}
        onChange={(e) => {
          onFieldChange("urdfUrl", e.target.value);
        }}
      />
    </Flex>
  );
}
