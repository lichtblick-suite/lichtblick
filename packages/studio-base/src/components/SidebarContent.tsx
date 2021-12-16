// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, Stack, Text, useTheme } from "@fluentui/react";
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
      verticalFill
      styles={{
        root: {
          maxHeight: "100%",
          overflow: "auto",
        },
      }}
      tokens={{
        childrenGap: theme.spacing.s1,
      }}
    >
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        tokens={{ padding: theme.spacing.m }}
        styles={{ root: { minHeight: 56 } }}
      >
        {leadingItems && (
          <Stack horizontal verticalAlign="center">
            {leadingItems.map((item, i) => (
              <Stack.Item key={i}>{item}</Stack.Item>
            ))}
          </Stack>
        )}
        <Stack.Item grow>
          <Text as="h2" variant="xLarge">
            {title}
          </Text>
        </Stack.Item>
        {trailingItemsWithHelp.length > 0 ? (
          <Stack horizontal verticalAlign="center">
            {trailingItemsWithHelp.map((item, i) => (
              <Stack.Item key={i}>{item}</Stack.Item>
            ))}
          </Stack>
        ) : undefined}
      </Stack>
      {showHelp ? (
        <Stack
          tokens={{
            padding: `0 ${theme.spacing.m} ${theme.spacing.m} ${theme.spacing.m}`,
          }}
        >
          <TextContent allowMarkdownHtml={true}>{helpContent}</TextContent>
        </Stack>
      ) : undefined}
      <Stack.Item
        tokens={{ padding: noPadding ? undefined : `0px ${theme.spacing.m} ${theme.spacing.m}` }}
        grow
      >
        {children}
      </Stack.Item>
    </Stack>
  );
}
