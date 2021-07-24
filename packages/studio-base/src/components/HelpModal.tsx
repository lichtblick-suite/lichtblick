// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Modal, makeStyles, useTheme } from "@fluentui/react";
import { PropsWithChildren, ReactElement } from "react";

import TextContent from "@foxglove/studio-base/components/TextContent";

const useStyles = makeStyles((theme) => ({
  content: {
    padding: theme.spacing.l1,
  },
  header: {
    display: "flex",
    flexDirection: "space-between",
    justifyContent: "flex-end",
    padding: theme.spacing.l1,
    position: "absolute",
    top: 0,
    right: 0,
  },
}));

export default function HelpModal({
  children,
  onRequestClose,
}: PropsWithChildren<{ onRequestClose: () => void }>): ReactElement {
  const classes = useStyles();
  const theme = useTheme();

  return (
    <Modal
      isOpen
      onDismiss={onRequestClose}
      styles={{
        scrollableContent: {
          maxWidth: 700,
          maxHeight: `calc(100vh - ${theme.spacing.l2})`,
        },
      }}
    >
      <div className={classes.header}>
        <IconButton
          styles={{
            root: {
              color: theme.palette.neutralSecondary,
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
      </div>
      <div className={classes.content}>
        <TextContent allowMarkdownHtml={true}>{children}</TextContent>
      </div>
    </Modal>
  );
}
