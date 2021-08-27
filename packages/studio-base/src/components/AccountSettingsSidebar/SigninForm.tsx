// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PrimaryButton, Stack, Text, useTheme } from "@fluentui/react";
import { ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsyncFn, useLocalStorage } from "react-use";

import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { DeviceCodeResponse } from "@foxglove/studio-base/services/ConsoleApi";

import AccountSyncGraphic from "./AccountSyncGraphic";
import DeviceCodeDialog from "./DeviceCodeDialog";

export default function SigninForm(): JSX.Element {
  const theme = useTheme();
  const { addToast } = useToasts();
  const api = useConsoleApi();
  const [_, setBearerToken] = useLocalStorage<string>("fox.bearer-token");
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | undefined>(undefined);

  const [{ value: deviceCodeResponse, error: deviceCodeError, loading }, getDeviceCode] =
    useAsyncFn(async () => {
      return await api.deviceCode({
        client_id: process.env.OAUTH_CLIENT_ID!,
      });
    }, [api]);

  useEffect(() => {
    setDeviceCode(deviceCodeResponse);
  }, [deviceCodeResponse]);

  const handleOnSigninClick = useCallback(() => {
    void getDeviceCode();
  }, [getDeviceCode]);

  useEffect(() => {
    if (deviceCodeError != undefined) {
      addToast(deviceCodeError.message, {
        appearance: "error",
      });
    }
  }, [addToast, deviceCodeError]);

  type OnClose = ComponentProps<typeof DeviceCodeDialog>["onClose"];
  const onClose = useCallback<NonNullable<OnClose>>(
    (session) => {
      setDeviceCode(undefined);
      if (session != undefined) {
        setBearerToken(session.bearer_token);
        window.location.reload();
      }
    },
    [setBearerToken],
  );

  // open new window with the device code to facilitate user signin flow
  useEffect(() => {
    if (deviceCode == undefined) {
      return;
    }

    const url = new URL(deviceCode.verification_uri);
    url.searchParams.append("user_code", deviceCode.user_code);
    const href = url.toString();

    window.open(href, "_blank");
  }, [deviceCode]);

  const modal = useMemo(() => {
    if (deviceCode != undefined) {
      return <DeviceCodeDialog deviceCode={deviceCode} onClose={onClose} />;
    }

    return ReactNull;
  }, [deviceCode, onClose]);

  return (
    <Stack tokens={{ childrenGap: theme.spacing.l1 }} styles={{ root: { lineHeight: "1.3" } }}>
      <Stack horizontal horizontalAlign="center" styles={{ root: { color: theme.palette.accent } }}>
        <AccountSyncGraphic width={192} />
      </Stack>
      <Text variant="mediumPlus">
        Sign in to access collaboration features like shared layouts.
      </Text>
      {modal}

      <PrimaryButton
        disabled={loading}
        text="Sign in"
        onClick={handleOnSigninClick}
        styles={{
          root: {
            marginLeft: 0,
            marginRight: 0,
          },
          rootDisabled: {
            cursor: "wait !important",
          },
        }}
      />
    </Stack>
  );
}
