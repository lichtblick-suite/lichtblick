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

import { Stack, Text, useTheme, Checkbox } from "@fluentui/react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";

type Feature = {
  key: AppSetting;
  name: string;
  description: JSX.Element;
};

const features: Feature[] = [
  {
    key: AppSetting.UNLIMITED_MEMORY_CACHE,
    name: "Unlimited in-memory cache",
    description: (
      <>
        Fully buffer a bag into memory. This may use up a lot of system memory. Changing this
        setting requires a restart.
      </>
    ),
  },
  {
    key: AppSetting.SHOW_DEBUG_PANELS,
    name: "Studio debug panels",
    description: <>Show Foxglove Studio debug panels in the add panel list.</>,
  },
  {
    key: AppSetting.ENABLE_DRAWING_POLYGONS,
    name: "Drawing polygons in 3D panel",
    description: <>Show sidebar control to draw polygons in the 3D panel.</>,
  },
  {
    key: AppSetting.ENABLE_LEGACY_PLOT_PANEL,
    name: "Legacy Plot panel",
    description: <>Enable the Legacy Plot panel.</>,
  },
  {
    key: AppSetting.ENABLE_CONSOLE_API_LAYOUTS,
    name: "Team shared layouts",
    description: <>Enable team layout sharing when signed in to Foxglove Studio.</>,
  },
];

function ExperimentalFeatureItem(props: { feature: Feature }) {
  const theme = useTheme();
  const { feature } = props;

  const [enabled, setEnabled] = useAppConfigurationValue<boolean>(feature.key);
  return (
    <Stack grow tokens={{ childrenGap: theme.spacing.s2 }}>
      <Checkbox
        onRenderLabel={() => {
          return (
            <Stack
              tokens={{ childrenGap: theme.spacing.s2 }}
              styles={{ root: { paddingLeft: theme.spacing.s2 } }}
            >
              <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                {feature.name}
              </Text>
              <Text
                variant="smallPlus"
                styles={{
                  root: {
                    color: theme.semanticColors.bodySubtext,
                  },
                }}
              >
                {feature.description}
              </Text>
            </Stack>
          );
        }}
        checked={enabled}
        onChange={(_, checked) => void setEnabled(checked)}
        styles={{
          text: {
            minWidth: 60,
          },
          label: { alignItems: "baseline" },
        }}
      />
    </Stack>
  );
}

export function ExperimentalFeatureSettings(): React.ReactElement {
  const theme = useTheme();
  return (
    <Stack tokens={{ childrenGap: theme.spacing.m }}>
      {features.length === 0 && (
        <p>
          <em>Currently there are no experimental features.</em>
        </p>
      )}
      {features.map((feature) => (
        <ExperimentalFeatureItem key={feature.key} feature={feature} />
      ))}
    </Stack>
  );
}
