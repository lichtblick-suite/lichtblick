// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, Icon, PrimaryButton, Stack, Text, useTheme } from "@fluentui/react";
import { useCallback } from "react";
import { useLocalStorage } from "react-use";

import Logger from "@foxglove/log";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { CurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";

const log = Logger.getLogger(__filename);

export default function AccountInfo(props: { me?: CurrentUser }): JSX.Element {
  const theme = useTheme();
  const api = useConsoleApi();
  const [_, _set, removeBearerToken] = useLocalStorage<string>("fox.bearer-token");

  const onSignoutClick = useCallback(async () => {
    api.signout().catch((err) => {
      log.error(err);
    });
    removeBearerToken();
    window.location.reload();
  }, [api, removeBearerToken]);

  if (!props.me) {
    return <></>;
  }

  return (
    <Stack verticalFill verticalAlign="space-between">
      <Stack tokens={{ childrenGap: theme.spacing.m }}>
        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: theme.spacing.s1 }}>
          <Icon
            iconName="BlockheadFilled"
            styles={{
              root: {
                color: theme.palette.themePrimary,
                fontSize: theme.fonts.superLarge.fontSize,
                height: theme.fonts.superLarge.fontSize,
              },
            }}
          />
          <Stack verticalAlign="center" tokens={{ childrenGap: theme.spacing.s2 }}>
            <Text
              variant="smallPlus"
              styles={{ root: { color: theme.semanticColors.bodySubtext } }}
            >
              Signed in as
            </Text>
            <Text variant="medium">{props.me.email ?? "(no email address)"}</Text>
          </Stack>
        </Stack>
        <PrimaryButton href={process.env.FOXGLOVE_ACCOUNT_DASHBOARD_URL}>
          Account settings
        </PrimaryButton>
      </Stack>
      <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
        <DefaultButton onClick={onSignoutClick}>Sign out</DefaultButton>
      </Stack>
    </Stack>
  );
}
