// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Text, useTheme } from "@fluentui/react";
import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { useState, useMemo } from "react";

import TextContent from "@foxglove/studio-base/components/TextContent";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    height: "100%",
    overflow: "auto",
    gap: theme.spacing(1),
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(2),
    minHeight: theme.spacing(7),
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing(0, 2, 2),
  },
  noPadding: {
    padding: 0,
  },
  helpContent: {
    padding: theme.spacing(0, 2, 2),
  },
  items: {
    display: "flex",
    alignItems: "center",
  },
}));

export function SidebarContent({
  noPadding = false,
  title,
  children,
  helpContent,
  leadingItems,
  trailingItems,
}: React.PropsWithChildren<{
  title: string;
  helpContent?: React.ReactNode;
  noPadding?: boolean;

  /** Buttons/items to display on the leading (left) side of the header */
  leadingItems?: React.ReactNode[];
  /** Buttons/items to display on the trailing (right) side of the header */
  trailingItems?: React.ReactNode[];
}>): JSX.Element {
  const classes = useStyles();
  const theme = useTheme();
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const button = useTooltip({ contents: showHelp ? "Hide help" : "Show help" });

  const trailingItemsWithHelp = useMemo(() => {
    if (helpContent != undefined) {
      return [
        ...(trailingItems ?? []),
        <IconButton
          elementRef={button.ref}
          key="help-icon"
          iconProps={{ iconName: showHelp ? "HelpCircleFilled" : "HelpCircle" }}
          onClick={() => setShowHelp(!showHelp)}
          styles={{
            icon: {
              color: theme.semanticColors.bodySubtext,

              svg: {
                fill: "currentColor",
                height: "1em",
                width: "1em",
              },
            },
          }}
        >
          {button.tooltip}
        </IconButton>,
      ];
    }
    return trailingItems ?? [];
  }, [helpContent, trailingItems, button, showHelp, theme]);

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        {leadingItems && (
          <div className={classes.items}>
            {leadingItems.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </div>
        )}
        <Text as="h2" variant="xLarge" styles={{ root: { flexGrow: 1, margin: 0 } }}>
          {title}
        </Text>
        {trailingItemsWithHelp.length > 0 && (
          <div className={classes.items}>
            {trailingItemsWithHelp.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </div>
        )}
      </div>
      {showHelp && (
        <div className={classes.helpContent}>
          <TextContent allowMarkdownHtml={true}>{helpContent}</TextContent>
        </div>
      )}
      <div
        className={cx(classes.content, {
          [classes.noPadding]: noPadding,
        })}
      >
        {children}
      </div>
    </div>
  );
}
