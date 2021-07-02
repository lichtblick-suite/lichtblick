// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PrimaryButton, Stack, useTheme } from "@fluentui/react";
import { useCallback, useEffect } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsync, useAsyncFn, useLocalStorage, useMountedState } from "react-use";

import Logger from "@foxglove/log";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { Org } from "@foxglove/studio-base/services/ConsoleApi";

import DeviceCode from "./DeviceCode";
import OrgSelect from "./OrgSelect";

const log = Logger.getLogger(__filename);

export default function SigninForm(): JSX.Element {
  const theme = useTheme();
  const { addToast } = useToasts();
  const api = useConsoleApi();
  const isMounted = useMountedState();
  const [_, setBearerToken] = useLocalStorage<string>("fox.bearer-token");

  const [{ value: deviceCode, error: deviceCodeError, loading }, getDeviceCode] =
    useAsyncFn(async () => {
      return api.deviceCode({
        client_id: process.env.OAUTH_CLIENT_ID!,
      });
    }, [api]);

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

  const { value: deviceResponse, error: deviceResponseError } = useAsync(async () => {
    if (!deviceCode) {
      return;
    }

    const endTimeMs = Date.now() + deviceCode.expires_in * 1000;

    // continue polling for the token until we receive the token or we timeout
    while (Date.now() < endTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, deviceCode.interval * 1000));
      // no need to query if no longer mounted
      if (!isMounted()) {
        return;
      }

      try {
        const tempAccess = await api.token({
          device_code: deviceCode.device_code,
          client_id: process.env.OAUTH_CLIENT_ID!,
        });
        return tempAccess;
      } catch (err) {
        log.warn(err);
        // ignore and retry
      }
    }

    throw new Error("Timeout");
  }, [api, deviceCode, isMounted]);

  useEffect(() => {
    if (deviceResponseError) {
      addToast(deviceResponseError.message, {
        appearance: "error",
      });
    }
  }, [addToast, deviceResponseError]);

  useEffect(() => {
    if (!deviceResponse) {
      return;
    }
    deviceResponse?.id_token;
  }, [deviceResponse]);

  const [{ value: session }, onOrgSelect] = useAsyncFn(
    async (org: Org) => {
      if (!deviceResponse) {
        return;
      }

      // get a refresh token from the endpoint
      return api.signin({
        id_token: deviceResponse.id_token,
        org_slug: org.slug,
      });
    },
    [api, deviceResponse],
  );

  useEffect(() => {
    if (!session) {
      return;
    }

    setBearerToken(session.bearer_token);
    window.location.reload();
  }, [session, setBearerToken]);

  if (session) {
    return <div>Success!</div>;
  }

  // if deviceResponse idtoken, show the orgs select list
  if (deviceResponse) {
    return <OrgSelect idToken={deviceResponse.id_token} onSelect={onOrgSelect} />;
  }

  if (deviceCode) {
    return (
      <DeviceCode userCode={deviceCode.user_code} verificationUrl={deviceCode.verification_uri} />
    );
  }

  return (
    <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
      <div>Sign in to access collaboration features like shared layouts.</div>
      <PrimaryButton disabled={loading} text="Sign in" onClick={handleOnSigninClick} />
    </Stack>
  );
}
