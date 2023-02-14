// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Dialog,
  Button,
  Link,
  Typography,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useEffect, useMemo } from "react";
import { useAsync, useMountedState } from "react-use";

import Logger from "@foxglove/log";
import Stack from "@foxglove/studio-base/components/Stack";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { Session } from "@foxglove/studio-base/services/ConsoleApi";
import delay from "@foxglove/studio-base/util/delay";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const log = Logger.getLogger(__filename);

type DeviceCodePanelProps = {
  onClose?: (session?: Session) => void;
};

// Show instructions on opening the browser and entering the device code
export default function DeviceCodeDialog(props: DeviceCodePanelProps): JSX.Element {
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

    const timeOutID = setTimeout(() => {
      window.open(href, "_blank");
    }, 700);

    return () => {
      clearTimeout(timeOutID);
    };
  }, [deviceCode]);

  const { value: deviceResponse, error: deviceResponseError } = useAsync(async () => {
    if (!deviceCode) {
      return;
    }
    const endTimeMs = Date.now() + deviceCode.expiresIn * 1000;

    // continue polling for the token until we receive the token or we timeout
    while (Date.now() < endTimeMs) {
      await delay(deviceCode.interval * 1000);
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
      <Stack gap={2.5}>
        <Stack style={{ lineHeight: 1.3 }}>
          <Typography>
            To complete sign in, follow the instructions in your browser with the code below.
          </Typography>
          <Typography
            fontSize="2.6rem"
            fontFamily={fonts.MONOSPACE}
            component="div"
            color="text.disabled"
          >
            {userCode}
          </Typography>
          <Typography>
            If your browser didn’t open automatically, please{" "}
            <Link
              underline="hover"
              variant="inherit"
              color="primary"
              href={`${verificationUri}?user_code=${userCode}`}
              target="_blank"
            >
              click here
            </Link>{" "}
            to continue.
          </Typography>
        </Stack>
      </Stack>
    );
  }, [deviceCode]);

  if (
    deviceCodeError != undefined ||
    deviceResponseError != undefined ||
    signinError != undefined
  ) {
    return (
      <Dialog open maxWidth="xs" fullWidth>
        <DialogTitle>Error</DialogTitle>
        <DialogContent>
          {deviceCodeError?.message ?? deviceResponseError?.message ?? signinError?.message}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" size="large" onClick={() => onClose?.()}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open maxWidth="xs" fullWidth>
      <DialogTitle>Sign in</DialogTitle>
      <DialogContent>{dialogContent}</DialogContent>
      <DialogActions>
        <Stack direction="row" flexGrow={1} justifyContent="space-between">
          <Stack direction="row" alignItems="center" flex="auto" gap={2}>
            <CircularProgress color="primary" size={16} />
            <Typography color="text.secondary">
              {deviceCode ? "Awaiting authentication…" : "Connecting…"}
            </Typography>
          </Stack>

          <Button variant="outlined" size="large" color="inherit" onClick={() => onClose?.()}>
            Cancel
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
