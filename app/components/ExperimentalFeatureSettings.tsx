// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ChoiceGroup, Stack, Text, useTheme } from "@fluentui/react";
import { useContext } from "react";

import ExperimentalFeaturesContext, {
  getDefaultKey,
} from "@foxglove-studio/app/context/ExperimentalFeaturesContext";

export function ExperimentalFeatureSettings(): React.ReactElement {
  const { settings, features, changeFeature } = useContext(ExperimentalFeaturesContext);
  const theme = useTheme();
  return (
    <Stack style={{ padding: theme.spacing.m }} tokens={{ childrenGap: theme.spacing.m }}>
      {Object.keys(features).length === 0 && (
        <p>
          <em>Currently there are no experimental features.</em>
        </p>
      )}
      {Object.entries(features).map(([id, feature]) => {
        const { enabled = false, manuallySet = false } = settings[id] ?? {};
        return (
          <Stack key={id}>
            <Text as="h2" variant="medium">
              {feature.name} <code style={{ fontSize: 12 }}>{id}</code>
            </Text>
            <ChoiceGroup
              options={[
                { key: "default", text: `Default (${feature[getDefaultKey()] ? "on" : "off"})` },
                { key: "alwaysOn", text: "On" },
                { key: "alwaysOff", text: "Off" },
              ]}
              selectedKey={manuallySet ? (enabled ? "alwaysOn" : "alwaysOff") : "default"}
              onChange={(_event, option) => {
                if (option) {
                  if (
                    option.key !== "default" &&
                    option.key !== "alwaysOn" &&
                    option.key !== "alwaysOff"
                  ) {
                    throw new Error(`Invalid value for radio button: ${option.key}`);
                  }
                  changeFeature(id, option.key);
                }
              }}
            />
          </Stack>
        );
      })}
    </Stack>
  );
}
