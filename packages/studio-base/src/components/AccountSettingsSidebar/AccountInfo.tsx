// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, Icon, PrimaryButton } from "@fluentui/react";
import { CircularProgress, Typography, useTheme } from "@mui/material";
import { useCallback } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsyncFn } from "react-use";

import Logger from "@foxglove/log";
import Stack from "@foxglove/studio-base/components/Stack";
import { useCurrentUser, User } from "@foxglove/studio-base/context/CurrentUserContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";

const log = Logger.getLogger(__filename);

export const AVATAR_ICON_SIZE = 42;

export default function AccountInfo(props: { currentUser?: User }): JSX.Element {
  const theme = useTheme();
  const { signOut } = useCurrentUser();
  const { addToast } = useToasts();
  const confirm = useConfirm();

  const [{ loading }, beginSignOut] = useAsyncFn(async () => {
    try {
      await signOut();
    } catch (error) {
      log.error(error);
      addToast((error as Error).toString(), { appearance: "error" });
    }
  }, [addToast, signOut]);

  const onSignoutClick = useCallback(() => {
    void confirm({
      title: "Are you sure you want to sign out?",
      ok: "Sign out",
    }).then((response) => {
      if (response === "ok") {
        void beginSignOut();
      }
    });
  }, [beginSignOut, confirm]);

  if (!props.currentUser) {
    return <></>;
  }

  return (
    <Stack fullHeight justifyContent="space-between">
      <Stack gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon
            iconName="BlockheadFilled"
            styles={{
              root: {
                color: theme.palette.primary.main,
                fontSize: AVATAR_ICON_SIZE,
                height: AVATAR_ICON_SIZE,
              },
            }}
          />
          <Stack justifyContent="center">
            <Typography variant="subtitle1">{props.currentUser.email}</Typography>
            <Typography variant="body2" color="text.secondary">
              {props.currentUser.orgDisplayName ?? props.currentUser.orgSlug}
            </Typography>
          </Stack>
        </Stack>
        <PrimaryButton href={process.env.FOXGLOVE_ACCOUNT_DASHBOARD_URL} target="_blank">
          Account settings
        </PrimaryButton>
      </Stack>
      <Stack gap={1}>
        <DefaultButton onClick={onSignoutClick}>
          Sign out&nbsp;{loading && <CircularProgress size={16} />}
        </DefaultButton>
      </Stack>
    </Stack>
  );
}
