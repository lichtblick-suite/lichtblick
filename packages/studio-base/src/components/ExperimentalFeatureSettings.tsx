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

import { Checkbox, FormControlLabel, Link, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";

const useStyles = makeStyles()({
  checkbox: {
    "&.MuiCheckbox-root": {
      paddingTop: 0,
    },
  },
  formControlLabel: {
    "&.MuiFormControlLabel-root": {
      alignItems: "start",
    },
  },
});

type Feature = {
  key: AppSetting;
  name: string;
  description: JSX.Element;
};

const features: Feature[] = [
  {
    key: AppSetting.SHOW_DEBUG_PANELS,
    name: "Studio debug panels",
    description: <>Show Foxglove Studio debug panels in the &ldquo;Add panel&rdquo; list.</>,
  },
  {
    key: AppSetting.ENABLE_LEGACY_PLOT_PANEL,
    name: "Legacy Plot panel",
    description: <>Enable the Legacy Plot panel.</>,
  },
  {
    key: AppSetting.EXPERIMENTAL_LATCHING,
    name: "Latching",
    description: <>Enable message latching for bag, mcap, and data platform sources.</>,
  },
  {
    key: AppSetting.ENABLE_MEMORY_USE_INDICATOR,
    name: "Memory use indicator",
    description: <>Show the app memory use in the sidebar.</>,
  },
];
if (process.env.NODE_ENV === "development") {
  features.push({
    key: AppSetting.ENABLE_LAYOUT_DEBUGGING,
    name: "Layout debugging",
    description: <>Show extra controls for developing and debugging layout storage.</>,
  });
  features.push({
    key: AppSetting.ENABLE_REACT_STRICT_MODE,
    name: "React Strict Mode",
    description: (
      <>
        Enable React{" "}
        <Link href="https://reactjs.org/docs/strict-mode.html" target="_blank" rel="noreferrer">
          Strict Mode
        </Link>
        . Changing this setting requires a restart.
      </>
    ),
  });
}

function ExperimentalFeatureItem(props: { feature: Feature }) {
  const { feature } = props;
  const { classes } = useStyles();

  const [enabled, setEnabled] = useAppConfigurationValue<boolean>(feature.key);
  return (
    <FormControlLabel
      className={classes.formControlLabel}
      control={
        <Checkbox
          className={classes.checkbox}
          checked={enabled}
          onChange={(_, checked) => void setEnabled(checked)}
        />
      }
      label={
        <Stack gap={0.25} paddingLeft={0.5}>
          <Typography fontWeight={600}>{feature.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {feature.description}
          </Typography>
        </Stack>
      }
    />
  );
}

export const ExperimentalFeatureSettings = (): React.ReactElement => (
  <Stack gap={2}>
    {features.length === 0 && (
      <Typography fontStyle="italic">Currently there are no experimental features.</Typography>
    )}
    {features.map((feature) => (
      <ExperimentalFeatureItem key={feature.key} feature={feature} />
    ))}
  </Stack>
);
