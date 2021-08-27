// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Stack,
  TextField,
  Text,
  Dialog,
  DialogFooter,
  DefaultButton,
  PrimaryButton,
  useTheme,
  Link,
} from "@fluentui/react";
import { useEffect, useMemo } from "react";
import { useAsync, useMountedState } from "react-use";

import Logger from "@foxglove/log";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { DeviceCodeResponse, Session } from "@foxglove/studio-base/services/ConsoleApi";

const log = Logger.getLogger(__filename);

type DeviceCodePanelProps = {
  deviceCode: DeviceCodeResponse;
  onClose?: (session?: Session) => void;
};

// Show instructions on opening the browser and entering the device code
export default function DeviceCodeDialog(props: DeviceCodePanelProps): JSX.Element {
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

  const { value: session, error: signinError } = useAsync(async () => {
    if (deviceResponse == undefined) {
      return;
    }

    return await api.signin({
      id_token: deviceResponse.id_token,
    });
  }, [api, deviceResponse]);

  const dialogContent = useMemo(() => {
    return (
      <Stack tokens={{ childrenGap: theme.spacing.l1 }}>
        <Stack tokens={{ childrenGap: theme.spacing.s1 }} styles={{ root: { lineHeight: "1.3" } }}>
          <Text variant="medium" block>
            To connect your Foxglove account, follow the instructions in your browser.
          </Text>
          <Text variant="medium" block>
            If your browser didn’t open automatically, please{" "}
            <Link href={`${verificationUrl}?user_code=${userCode}`}>click here</Link> to continue.
          </Text>
        </Stack>

        <TextField
          label="Your device confirmation code is:"
          value={userCode}
          autoFocus
          readOnly
          styles={{
            root: {
              textAlign: "center",
            },
            field: {
              fontSize: theme.fonts.xxLarge.fontSize,
              textAlign: "center",
            },
            fieldGroup: {
              marginTop: theme.spacing.s2,
              height: 48,
            },
          }}
        />
      </Stack>
    );
  }, [userCode, verificationUrl, theme]);

  useEffect(() => {
    if (session != undefined) {
      onClose?.(session);
    }
  }, [onClose, session]);

  if (deviceResponseError != undefined || signinError != undefined) {
    return (
      <Dialog hidden={false} title="Error">
        {deviceResponseError?.message ?? signinError?.message}
        <DialogFooter>
          <PrimaryButton text="Done" onClick={() => onClose?.()} />
        </DialogFooter>
      </Dialog>
    );
  }

  return (
    <Dialog hidden={false} minWidth={440} title="Complete Sign in">
      {dialogContent}
      <DialogFooter>
        <DefaultButton text="Cancel" onClick={() => onClose?.()} />
      </DialogFooter>
    </Dialog>
  );
}
