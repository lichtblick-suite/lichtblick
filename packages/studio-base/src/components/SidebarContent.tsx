// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Text, useTheme } from "@fluentui/react";
import { Box, Stack } from "@mui/material";
import { useState, useMemo } from "react";

import TextContent from "@foxglove/studio-base/components/TextContent";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";

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
    <Stack
      flex="auto"
      spacing={1}
      sx={{
        height: "100%",
        overflow: "auto",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        padding={2}
        sx={{ minHeight: 56 }}
      >
        {leadingItems && (
          <Stack direction="row" alignItems="center">
            {leadingItems.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </Stack>
        )}
        <Box flexGrow={1}>
          <Text as="h2" variant="xLarge">
            {title}
          </Text>
        </Box>
        {trailingItemsWithHelp.length > 0 ? (
          <Stack direction="row" alignItems="center">
            {trailingItemsWithHelp.map((item, i) => (
              <div key={i}>{item}</div>
            ))}
          </Stack>
        ) : undefined}
      </Stack>
      {showHelp ? (
        <Stack padding={2} paddingTop={0}>
          <TextContent allowMarkdownHtml={true}>{helpContent}</TextContent>
        </Stack>
      ) : undefined}
      <Box flexGrow={1} padding={noPadding ? undefined : 2} paddingTop={0}>
        {children}
      </Box>
    </Stack>
  );
}
