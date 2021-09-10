// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DefaultButton,
  Icon,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  useTheme,
} from "@fluentui/react";
import { useToasts } from "react-toast-notifications";
import { useAsyncFn } from "react-use";

import Logger from "@foxglove/log";
import { useCurrentUser, User } from "@foxglove/studio-base/context/CurrentUserContext";

const log = Logger.getLogger(__filename);

export default function AccountInfo(props: { currentUser?: User }): JSX.Element {
  const theme = useTheme();
  const { signOut } = useCurrentUser();
  const { addToast } = useToasts();

  const [{ loading }, onSignoutClick] = useAsyncFn(async () => {
    try {
      await signOut();
    } catch (error) {
      log.error(error);
      addToast(error.toString(), { appearance: "error" });
    }
  }, [addToast, signOut]);

  if (!props.currentUser) {
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
            <Text variant="medium">{props.currentUser.email ?? "(no email address)"}</Text>
            <Text
              variant="smallPlus"
              styles={{ root: { color: theme.semanticColors.bodySubtext } }}
            >
              {props.currentUser.orgDisplayName ?? props.currentUser.orgSlug}
            </Text>
          </Stack>
        </Stack>
        <PrimaryButton href={process.env.FOXGLOVE_ACCOUNT_DASHBOARD_URL}>
          Account settings
        </PrimaryButton>
      </Stack>
      <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
        <DefaultButton onClick={onSignoutClick}>
          Sign out&nbsp;{loading && <Spinner size={SpinnerSize.small} />}
        </DefaultButton>
      </Stack>
    </Stack>
  );
}
