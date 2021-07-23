// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PrimaryButton, Stack, StackItem, useTheme } from "@fluentui/react";
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
    <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
      <StackItem>
        <div>Signed in as: {props.me.email ?? "(no email address)"}</div>
      </StackItem>
      <StackItem>
        <PrimaryButton onClick={onSignoutClick}>Sign out</PrimaryButton>
      </StackItem>
    </Stack>
  );
}
