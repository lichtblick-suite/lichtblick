// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Modal, Text, TextField, makeStyles, useTheme } from "@fluentui/react";

import { DetailsType, NotificationSeverity } from "@foxglove/studio-base/util/sendNotification";

export type NotificationMessage = {
  readonly id: string;
  readonly message: string;
  readonly details: DetailsType;
  readonly read: boolean;
  readonly created: Date;
  readonly severity: NotificationSeverity;
};

const useStyles = makeStyles((theme) => ({
  content: {
    padding: theme.spacing.l1,
    borderTop: `1px solid ${theme.semanticColors.bodyDivider}`,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.l1,
  },
}));

export default function NotificationModal({
  notification: { details, message, severity },
  onRequestClose,
}: {
  notification: NotificationMessage;
  onRequestClose: () => void;
}): React.ReactElement {
  const classes = useStyles();
  const theme = useTheme();

  const displayPropsBySeverity = {
    error: theme.semanticColors.errorBackground,
    warn: theme.semanticColors.warningBackground,
    info: theme.palette.blueLight,
  };

  return (
    <Modal isOpen onDismiss={onRequestClose}>
      <header className={classes.header}>
        <Text
          variant="xLarge"
          nowrap
          style={{
            color: displayPropsBySeverity[severity],
          }}
        >
          {message}
        </Text>
        <IconButton
          styles={{
            root: {
              color: theme.palette.neutralSecondary,
              margin: 0, // TODO: remove this once global.scss is removed
              marginLeft: theme.spacing.l1,
            },
            rootHovered: {
              color: theme.palette.neutralSecondaryAlt,
            },
            icon: {
              verticalAlign: "top",
              marginLeft: theme.spacing.s1,
              marginRight: theme.spacing.s1,
              height: theme.spacing.l2,
              lineHeight: theme.spacing.l2,
              textAlign: "center",
              flexShrink: 0,
            },
          }}
          ariaLabel="Close help modal"
          iconProps={{ iconName: "Cancel" }}
          onClick={onRequestClose}
        />
      </header>
      <div className={classes.content}>
        {details instanceof Error ? (
          <TextField
            styles={{
              field: {
                color: theme.semanticColors.bodyText,
                fontSize: "81.25%",
                fontFamily: "'Ubuntu Mono', Menlo, Monaco, Courier, monospace !important",
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
      </div>
    </Modal>
  );
}
