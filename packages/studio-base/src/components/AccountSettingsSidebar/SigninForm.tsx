// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PrimaryButton, Stack, StackItem, useTheme } from "@fluentui/react";
import { ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsyncFn, useLocalStorage } from "react-use";

import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { DeviceCodeResponse } from "@foxglove/studio-base/services/ConsoleApi";

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
    if (deviceCodeError) {
      addToast(deviceCodeError.message, {
        appearance: "error",
      });
    }
  }, [addToast, deviceCodeError]);

  type OnClose = ComponentProps<typeof DeviceCodeDialog>["onClose"];
  const onClose = useCallback<NonNullable<OnClose>>(
    (session) => {
      setDeviceCode(undefined);
      if (session) {
        setBearerToken(session.bearer_token);
        window.location.reload();
      }
    },
    [setBearerToken],
  );

  const modal = useMemo(() => {
    if (deviceCode) {
      return <DeviceCodeDialog deviceCode={deviceCode} onClose={onClose} />;
    }

    return ReactNull;
  }, [deviceCode, onClose]);

  return (
    <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
      <StackItem>
        <div>Sign in to access collaboration features like shared layouts.</div>
      </StackItem>
      <StackItem>
        <PrimaryButton disabled={loading} text="Sign in" onClick={handleOnSigninClick} />
      </StackItem>
      {modal}
    </Stack>
  );
}
