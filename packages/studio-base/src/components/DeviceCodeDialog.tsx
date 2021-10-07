// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Stack,
  Text,
  Dialog,
  DialogFooter,
  DefaultButton,
  PrimaryButton,
  useTheme,
  Link,
  Spinner,
  SpinnerSize,
} from "@fluentui/react";
import { useEffect, useMemo } from "react";
import { useAsync, useMountedState } from "react-use";

import Logger from "@foxglove/log";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { Session } from "@foxglove/studio-base/services/ConsoleApi";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const log = Logger.getLogger(__filename);

type DeviceCodePanelProps = {
  onClose?: (session?: Session) => void;
};

// Show instructions on opening the browser and entering the device code
export default function DeviceCodeDialog(props: DeviceCodePanelProps): JSX.Element {
  const theme = useTheme();
  const isMounted = useMountedState();
  const api = useConsoleApi();
  const { onClose } = props;

  const { value: deviceCode, error: deviceCodeError } = useAsync(async () => {
    return await api.deviceCode({
      clientId: process.env.OAUTH_CLIENT_ID!,
    });
  }, [api]);

  // open new window with the device code to facilitate user signin flow
  useEffect(() => {
    if (deviceCode == undefined) {
      return;
    }

    const url = new URL(deviceCode.verificationUri);
    url.searchParams.append("user_code", deviceCode.userCode);
    const href = url.toString();

    setTimeout(() => {
      window.open(href, "_blank");
    }, 700);
  }, [deviceCode]);

  const { value: deviceResponse, error: deviceResponseError } = useAsync(async () => {
    if (!deviceCode) {
      return;
    }
    const endTimeMs = Date.now() + deviceCode.expiresIn * 1000;

    // continue polling for the token until we receive the token or we timeout
    while (Date.now() < endTimeMs) {
      await new Promise((resolve) => setTimeout(resolve, deviceCode.interval * 1000));
      // no need to query if no longer mounted
      if (!isMounted()) {
        return;
      }

      try {
        const tempAccess = await api.token({
          deviceCode: deviceCode.deviceCode,
          clientId: process.env.OAUTH_CLIENT_ID!,
        });
        return tempAccess;
      } catch (err) {
        log.warn(err);
        // ignore and retry
      }
    }

    throw new Error("Timeout waiting for activation");
  }, [api, deviceCode, isMounted]);

  const { value: session, error: signinError } = useAsync(async () => {
    if (deviceResponse == undefined) {
      return;
    }

    return await api.signin({
      idToken: deviceResponse.idToken,
    });
  }, [api, deviceResponse]);

  useEffect(() => {
    if (session != undefined) {
      onClose?.(session);
    }
  }, [onClose, session]);

  const dialogContent = useMemo(() => {
    if (!deviceCode) {
      return ReactNull;
    }
    const { userCode, verificationUri } = deviceCode;
    return (
      <Stack tokens={{ childrenGap: theme.spacing.l1 }}>
        <Stack tokens={{ childrenGap: theme.spacing.s1 }} styles={{ root: { lineHeight: "1.3" } }}>
          <Text variant="medium" block>
            To complete sign in, follow the instructions in your browser with the code below.
          </Text>
          <Text
            styles={{
              root: {
                fontSize: theme.fonts.superLarge.fontSize,
                color: theme.semanticColors.disabledBodyText,
                fontFamily: fonts.MONOSPACE,
              },
            }}
          >
            {userCode}
          </Text>
          <Text variant="medium" block>
            If your browser didn’t open automatically, please{" "}
            <Link href={`${verificationUri}?user_code=${userCode}`}>click here</Link> to continue.
          </Text>
        </Stack>
      </Stack>
    );
  }, [deviceCode, theme]);

  if (
    deviceCodeError != undefined ||
    deviceResponseError != undefined ||
    signinError != undefined
  ) {
    return (
      <Dialog hidden={false} title="Error">
        {deviceCodeError?.message ?? deviceResponseError?.message ?? signinError?.message}
        <DialogFooter>
          <PrimaryButton text="Done" onClick={() => onClose?.()} />
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog hidden={false} minWidth={440} title="Sign in">
      {dialogContent}
      <DialogFooter styles={{ action: { display: "block" } }}>
        <Stack horizontal grow horizontalAlign="space-between">
          <Spinner
            size={SpinnerSize.small}
            label={deviceCode ? "Awaiting authentication…" : "Connecting…"}
            labelPosition="right"
            styles={{
              label: {
                fontSize: theme.fonts.medium.fontSize,
                color: theme.semanticColors.bodyText,
              },
            }}
          />
          <DefaultButton text="Cancel" onClick={() => onClose?.()} />
        </Stack>
      </DialogFooter>
    </Dialog>
  );
}
