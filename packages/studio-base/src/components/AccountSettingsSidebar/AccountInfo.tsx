// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DefaultButton,
  Icon,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Text,
  useTheme,
} from "@fluentui/react";
import { Stack } from "@mui/material";
import { useCallback } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsyncFn } from "react-use";

import Logger from "@foxglove/log";
import { useCurrentUser, User } from "@foxglove/studio-base/context/CurrentUserContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";

const log = Logger.getLogger(__filename);

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
    <Stack height="100%" justifyContent="space-between">
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
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
          <Stack justifyContent="center" spacing={0.5}>
            <Text variant="medium">{props.currentUser.email ?? "(no email address)"}</Text>
            <Text
              variant="smallPlus"
              styles={{ root: { color: theme.semanticColors.bodySubtext } }}
            >
              {props.currentUser.orgDisplayName ?? props.currentUser.orgSlug}
            </Text>
          </Stack>
        </Stack>
        <PrimaryButton href={process.env.FOXGLOVE_ACCOUNT_DASHBOARD_URL} target="_blank">
          Account settings
        </PrimaryButton>
      </Stack>
      <Stack spacing={1}>
        <DefaultButton onClick={onSignoutClick}>
          Sign out&nbsp;{loading && <Spinner size={SpinnerSize.small} />}
        </DefaultButton>
      </Stack>
    </Stack>
  );
}
