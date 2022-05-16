// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, TextField, IModalProps } from "@fluentui/react";
import { Typography, useTheme } from "@mui/material";

import { useDialogHostId } from "@foxglove/studio-base/context/DialogHostIdContext";
import { NotificationMessage } from "@foxglove/studio-base/util/sendNotification";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

export default function NotificationModal({
  notification: { details, message, severity, subText },
  onRequestClose,
}: {
  notification: NotificationMessage;
  onRequestClose: IModalProps["onDismiss"];
}): React.ReactElement {
  const theme = useTheme();
  const hostId = useDialogHostId();

  const displayPropsBySeverity = {
    error: theme.palette.error.main,
    warn: theme.palette.warning.main,
    info: theme.palette.info.main,
  };

  return (
    <Dialog
      hidden={false}
      onDismiss={onRequestClose}
      dialogContentProps={{
        title: message,
        titleProps: {
          style: {
            color: displayPropsBySeverity[severity],
          },
        },
        subText,
        showCloseButton: true,
      }}
      modalProps={{ layerProps: { hostId } }}
      minWidth={700}
    >
      {details instanceof Error ? (
        <TextField
          styles={{
            field: {
              color: theme.palette.text.primary,
              fontSize: theme.typography.body2.fontSize,
              fontFamily: `${fonts.MONOSPACE} !important`,
              maxHeight: "50vh",
              overflowY: "auto",
            },
          }}
          readOnly
          disabled
          multiline
          cols={90}
          rows={12}
          value={details.stack}
          underlined={false}
        />
      ) : details != undefined && details !== "" ? (
        <Typography style={{ whiteSpace: "pre-line" /* allow newlines in the details message */ }}>
          {details}
        </Typography>
      ) : (
        "No details provided"
      )}
    </Dialog>
  );
}
