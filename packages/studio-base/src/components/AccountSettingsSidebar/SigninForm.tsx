// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PrimaryButton, Stack, Text, useTheme } from "@fluentui/react";
import { useCallback, useState } from "react";

import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { Session } from "@foxglove/studio-base/services/ConsoleApi";

import AccountSyncGraphic from "./AccountSyncGraphic";
import DeviceCodeDialog from "./DeviceCodeDialog";

export default function SigninForm(): JSX.Element {
  const theme = useTheme();
  const { setBearerToken } = useCurrentUser();
  const [modalOpen, setModalOpen] = useState(false);

  const handleOnSigninClick = useCallback(() => setModalOpen(true), []);

  const onClose = useCallback(
    (session?: Session) => {
      setModalOpen(false);
      if (session != undefined) {
        setBearerToken(session.bearer_token);
      }
    },
    [setBearerToken],
  );

  return (
    <>
      {modalOpen && <DeviceCodeDialog onClose={onClose} />}
      <Stack tokens={{ childrenGap: theme.spacing.l1 }} styles={{ root: { lineHeight: "1.3" } }}>
        <Stack
          horizontal
          horizontalAlign="center"
          styles={{ root: { color: theme.palette.accent } }}
        >
          <AccountSyncGraphic width={192} />
        </Stack>
        <Text variant="medium">
          Create a Foxglove account to sync your layouts across multiple devices, and share them
          with your team.
        </Text>

        <PrimaryButton
          text="Sign in"
          onClick={handleOnSigninClick}
          styles={{
            root: {
              marginLeft: 0,
              marginRight: 0,
            },
          }}
        />
      </Stack>
    </>
  );
}
