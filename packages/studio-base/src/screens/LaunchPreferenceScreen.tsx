// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  CompoundButton,
  Checkbox,
  Stack,
  Text,
  useTheme,
  makeStyles,
  IButtonStyles,
} from "@fluentui/react";
import { ReactElement, useState } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { useSessionStorageValue } from "@foxglove/studio-base/hooks/useSessionStorageValue";

const useStyles = makeStyles((theme) => ({
  container: {
    border: `1px solid ${theme.semanticColors.bodyDivider}`,
    borderRadius: theme.effects.roundedCorner4,
    marginBottom: theme.spacing.l2,
  },
  title: {
    textAlign: "center",
    marginBottom: theme.spacing.m,
  },
}));

const buttonStyles = {
  root: { flex: "0 1 100%" },
  flexContainer: { alignItems: "center" },
} as Partial<IButtonStyles>;

export function LaunchPreferenceScreen(): ReactElement {
  const theme = useTheme();
  const classes = useStyles();

  const [globalPreference, setGlobalPreference] = useAppConfigurationValue<string | undefined>(
    AppSetting.LAUNCH_PREFERENCE,
  );
  const [_, setSessionPreference] = useSessionStorageValue(AppSetting.LAUNCH_PREFERENCE);
  const [rememberPreference, setRememberPreference] = useState(globalPreference != undefined);

  const cleanWebURL = new URL(window.location.href);
  cleanWebURL.searchParams.delete("launch");

  async function launchInWeb() {
    if (rememberPreference) {
      await setGlobalPreference("web");
    } else {
      setSessionPreference("web");
    }
  }

  async function launchInDesktop() {
    if (rememberPreference) {
      await setGlobalPreference("desktop");
    } else {
      setSessionPreference("desktop");
    }
  }

  async function toggleRememberPreference() {
    if (rememberPreference) {
      await setGlobalPreference(undefined);
    }

    setRememberPreference(!rememberPreference);
  }

  return (
    <Stack horizontalAlign="center" verticalAlign="center" verticalFill>
      <Stack
        className={classes.container}
        tokens={{
          childrenGap: theme.spacing.l1,
          padding: theme.spacing.l1,
          maxWidth: 480,
        }}
      >
        <Text className={classes.title} variant="xxLarge">
          Launch Foxglove Studio
        </Text>
        <Stack horizontal tokens={{ childrenGap: theme.spacing.m }}>
          <CompoundButton
            styles={buttonStyles}
            onClick={() => void launchInWeb()}
            secondaryText="Requires Chrome v76+"
          >
            Web
          </CompoundButton>
          <CompoundButton
            styles={buttonStyles}
            onClick={() => void launchInDesktop()}
            secondaryText="For Linux, Windows, and macOS"
          >
            Desktop App
          </CompoundButton>
        </Stack>
        <Checkbox
          label="Remember my preference"
          checked={rememberPreference}
          onChange={toggleRememberPreference}
        />
      </Stack>
    </Stack>
  );
}
