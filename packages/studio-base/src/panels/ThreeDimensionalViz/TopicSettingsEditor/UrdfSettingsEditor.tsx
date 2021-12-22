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

import { Link, Text, TextField } from "@fluentui/react";

import Flex from "@foxglove/studio-base/components/Flex";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

import { TopicSettingsEditorProps } from ".";

export type UrdfSettings = {
  urdfUrl?: string;
};

// One day we can think about using feature detection. Until that day comes we acknowledge the
// realities of only having two platforms: web and desktop.
const supportsPackageUrl = isDesktopApp();

export default function UrdfSettingsEditor(
  props: TopicSettingsEditorProps<undefined, UrdfSettings>,
): React.ReactElement {
  const { settings = {}, onFieldChange } = props;

  const descriptionString = supportsPackageUrl
    ? "package:// URL or http(s) URL pointing to a Unified Robot Description Format (URDF) XML file"
    : "http(s) URL pointing to a Unified Robot Description Format (URDF) XML file";

  return (
    <Flex col>
      <TextField
        label={descriptionString}
        value={settings.urdfUrl ?? ""}
        onChange={(_, newValue) => {
          onFieldChange("urdfUrl", newValue);
        }}
      />
      {!supportsPackageUrl && (
        <Text block as="p">
          For ROS users, we also support package:// URLs (loaded from the local filesystem) in our{" "}
          <Link href="https://foxglove.dev/download" target="_blank" rel="noreferrer">
            desktop app
          </Link>
          .
        </Text>
      )}
    </Flex>
  );
}
