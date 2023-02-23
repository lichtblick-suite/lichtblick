// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  Grid,
  Typography,
} from "@mui/material";
import { ReactElement, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { useSessionStorageValue } from "@foxglove/studio-base/hooks/useSessionStorageValue";
import { LaunchPreferenceValue } from "@foxglove/studio-base/types/LaunchPreferenceValue";

const useStyles = makeStyles()((theme) => ({
  button: {
    textAlign: "left",
    justifyContent: "flex-start",
    padding: theme.spacing(2),
    gap: theme.spacing(1.5),
    borderColor: theme.palette.divider,
    height: "100%",
  },
  paper: {
    maxWidth: 480,
  },
}));

export function LaunchPreferenceScreen(): ReactElement {
  const { classes } = useStyles();
  const [globalPreference, setGlobalPreference] = useAppConfigurationValue<string | undefined>(
    AppSetting.LAUNCH_PREFERENCE,
  );
  const [_, setSessionPreference] = useSessionStorageValue(AppSetting.LAUNCH_PREFERENCE);
  const [rememberPreference, setRememberPreference] = useState(globalPreference != undefined);

  async function launchInWeb() {
    setSessionPreference(LaunchPreferenceValue.WEB); // always set session preference to allow overriding the URL param
    if (rememberPreference) {
      await setGlobalPreference(LaunchPreferenceValue.WEB);
    }
  }

  async function launchInDesktop() {
    setSessionPreference(LaunchPreferenceValue.DESKTOP); // always set session preference to allow overriding the URL param
    if (rememberPreference) {
      await setGlobalPreference(LaunchPreferenceValue.DESKTOP);
    }
  }

  async function toggleRememberPreference() {
    if (rememberPreference) {
      await setGlobalPreference(undefined);
    }
    setRememberPreference(!rememberPreference);
  }

  const actions = [
    {
      key: LaunchPreferenceValue.WEB,
      primary: "Web",
      secondary: "Requires Chrome v76+",
      onClick: () => void launchInWeb(),
    },
    {
      key: LaunchPreferenceValue.DESKTOP,
      primary: "Desktop App",
      secondary: "For Linux, Windows, and macOS",
      onClick: () => void launchInDesktop(),
    },
  ];

  return (
    <Dialog open classes={{ paper: classes.paper }}>
      <Stack paddingX={2} paddingTop={3}>
        <Typography align="center" variant="h2" fontWeight={600}>
          Launch Foxglove Studio
        </Typography>
      </Stack>
      <DialogContent>
        <Grid container spacing={1}>
          {actions.map((action) => (
            <Grid key={action.key} item xs={12} sm={6}>
              <Button
                className={classes.button}
                fullWidth
                color="inherit"
                variant="outlined"
                size="large"
                onClick={action.onClick}
              >
                <Stack flex="auto" zeroMinWidth>
                  <Typography variant="subtitle1" color="text.primary">
                    {action.primary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.secondary}
                  </Typography>
                </Stack>
              </Button>
            </Grid>
          ))}
          <Grid item xs={12}>
            <FormControlLabel
              label="Remember my preference"
              control={
                <Checkbox
                  color="primary"
                  checked={rememberPreference}
                  onChange={toggleRememberPreference}
                />
              }
            />
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
