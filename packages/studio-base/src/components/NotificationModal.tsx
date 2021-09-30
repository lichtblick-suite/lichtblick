// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, Text, TextField, useTheme, IModalProps } from "@fluentui/react";

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

  const displayPropsBySeverity = {
    error: theme.semanticColors.errorBackground,
    warn: theme.semanticColors.warningBackground,
    info: theme.palette.blueLight,
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
      minWidth={700}
    >
      {details instanceof Error ? (
        <TextField
          styles={{
            field: {
              color: theme.semanticColors.bodyText,
              fontSize: theme.fonts.small.fontSize,
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
        <Text>{details}</Text>
      ) : (
        "No details provided"
      )}
    </Dialog>
  );
}
