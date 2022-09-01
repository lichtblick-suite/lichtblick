// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import HelpIcon from "@mui/icons-material/Help";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { IconButton, Typography } from "@mui/material";
import { useState, useMemo, CSSProperties, Fragment } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import TextContent from "@foxglove/studio-base/components/TextContent";

const useStyles = makeStyles()((theme) => ({
  leadingItems: {
    display: "flex",
    alignItems: "center",
    marginLeft: theme.spacing(-1),
    gap: theme.spacing(0.5),
  },
  toolbar: {
    minHeight: 56,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(2),
    gap: theme.spacing(0.5),
  },
}));

export function SidebarContent({
  disablePadding = false,
  title,
  children,
  helpContent,
  leadingItems,
  overflow = "auto",
  trailingItems,
}: React.PropsWithChildren<SidebarContentProps>): JSX.Element {
  const { classes } = useStyles();
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const trailingItemsWithHelp = useMemo(() => {
    if (helpContent != undefined) {
      return [
        ...(trailingItems ?? []),
        <IconButton
          color={showHelp ? "inherit" : "primary"}
          title={showHelp ? "Hide help" : "Show help"}
          key="help-icon"
          onClick={() => setShowHelp(!showHelp)}
        >
          {showHelp ? <HelpIcon /> : <HelpOutlineIcon />}
        </IconButton>,
      ];
    }
    return trailingItems ?? [];
  }, [helpContent, trailingItems, showHelp]);

  return (
    <Stack overflow={overflow} fullHeight flex="auto" gap={1}>
      <div className={classes.toolbar}>
        {leadingItems != undefined && (
          <div className={classes.leadingItems}>
            {leadingItems.map((item, i) => (
              <Fragment key={i}>{item}</Fragment>
            ))}
          </div>
        )}
        <Typography component="h2" variant="h4" fontWeight={800} flex="auto">
          {title}
        </Typography>
        {trailingItemsWithHelp.length > 0 && (
          <Stack direction="row" alignItems="center">
            {trailingItemsWithHelp.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </Stack>
        )}
      </div>
      {showHelp && (
        <Stack paddingX={2} paddingBottom={2}>
          <TextContent allowMarkdownHtml={true}>{helpContent}</TextContent>
        </Stack>
      )}
      <Stack flex="auto" {...(!disablePadding && { paddingX: 2, paddingBottom: 2 })}>
        {children}
      </Stack>
    </Stack>
  );
}

type SidebarContentProps = {
  title: string;
  helpContent?: React.ReactNode;
  disablePadding?: boolean;

  /** Buttons/items to display on the leading (left) side of the header */
  leadingItems?: React.ReactNode[];

  /** Overflow style of root element
   * @default: "auto"
   */
  overflow?: CSSProperties["overflow"];

  /** Buttons/items to display on the trailing (right) side of the header */
  trailingItems?: React.ReactNode[];
};
