// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Stack,
  StackItem,
  Text,
  makeStyles,
  Dialog,
  DialogFooter,
  PrimaryButton,
  useTheme,
  Spinner,
} from "@fluentui/react";
import { useEffect, useMemo } from "react";
import { useAsync, useAsyncFn, useMountedState } from "react-use";

import Logger from "@foxglove/log";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { DeviceCodeResponse, Org, Session } from "@foxglove/studio-base/services/ConsoleApi";

const log = Logger.getLogger(__filename);

type DeviceCodePanelProps = {
  deviceCode: DeviceCodeResponse;
  onClose?: (session?: Session) => void;
};

const useStyles = makeStyles((theme) => {
  return {
    text: {
      textAlign: "center",
      fontWeight: "bold",
      padding: theme.spacing.l1,
    },
    orgItem: {
      cursor: "pointer",

      ":hover": {
        opacity: 0.8,
      },
    },
  };
});

// Show instructions on opening the browser and entering the device code
export default function DeviceCodeDialog(props: DeviceCodePanelProps): JSX.Element {
  const classes = useStyles();
  const theme = useTheme();
  const isMounted = useMountedState();
  const api = useConsoleApi();

  const { deviceCode, onClose } = props;
  const { user_code: userCode, verification_uri: verificationUrl } = deviceCode;

  const { value: deviceResponse, error: deviceResponseError } = useAsync(async () => {
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

    throw new Error("Timeout waiting for activation");
  }, [api, deviceCode, isMounted]);

  const [{ value: session, error: signinError }, onOrgSelect] = useAsyncFn(
    async (org: Org) => {
      if (!deviceResponse) {
        throw new Error("Unable to signin");
      }

      return await api.signin({
        id_token: deviceResponse.id_token,
        org_slug: org.slug,
      });
    },
    [api, deviceResponse],
  );

  const { value: orgs, error: orgsError } = useAsync(async () => {
    const idToken = deviceResponse?.id_token;
    if (idToken == undefined) {
      return;
    }

    api.setAuthHeader(`IdToken ${idToken}`);
    return await api.orgs();
  }, [api, deviceResponse]);

  const dialogTitle = useMemo(() => {
    if (orgs) {
      return "Select an org";
    }

    if (deviceResponse) {
      return "Loading your orgs";
    }

    return "Complete Sign in";
  }, [orgs, deviceResponse]);

  const dialogContent = useMemo(() => {
    if (deviceResponse) {
      if (!orgs) {
        return (
          <Stack>
            <Spinner />
          </Stack>
        );
      }

      if (orgs.length === 0) {
        return (
          <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
            <StackItem>
              <Text>You are not a member of any orgs.</Text>
            </StackItem>
            <StackItem>
              <Text>
                Please ask your Org adminstrator to invite you or visit{" "}
                <a href="https://console.foxglove.dev/signin" target="_blank" rel="noreferrer">
                  console.foxglove.dev/signin
                </a>{" "}
                to sign up and create an org.
              </Text>
            </StackItem>
          </Stack>
        );
      }

      return (
        <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
          {orgs?.map((org) => {
            return (
              <StackItem
                key={org.id}
                onClick={async () => await onOrgSelect(org)}
                className={classes.orgItem}
              >
                <Text variant="large">{org.display_name ?? org.slug}</Text>
              </StackItem>
            );
          })}
        </Stack>
      );
    }

    return (
      <Stack tokens={{ childrenGap: theme.spacing.s1 }}>
        <Text variant="large">Your sign-in code is</Text>
        <StackItem className={classes.text}>
          <Text variant="xLarge">{userCode} </Text>
        </StackItem>

        <StackItem>
          <Text variant="large">Visit the link below to confirm the code</Text>
        </StackItem>
        <StackItem className={classes.text}>
          <Text variant="large">
            <a href={`${verificationUrl}?code=${userCode}`}>{verificationUrl}</a>
          </Text>
        </StackItem>

        <Text variant="large">Waiting for activation...</Text>
      </Stack>
    );
  }, [onOrgSelect, orgs, classes, deviceResponse, userCode, verificationUrl, theme]);

  useEffect(() => {
    if (session) {
      onClose?.(session);
    }
  }, [onClose, session]);

  if (orgsError || deviceResponseError || signinError) {
    return (
      <Dialog hidden={false} title="Error">
        {orgsError?.message ?? deviceResponseError?.message ?? signinError?.message}
        <DialogFooter>
          <PrimaryButton text="close" onClick={() => onClose?.()} />
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog hidden={false} maxWidth="33%" title={dialogTitle}>
      {dialogContent}
      <DialogFooter>
        <PrimaryButton text="cancel" onClick={() => onClose?.()} />
      </DialogFooter>
    </Dialog>
  );
}
