// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, Text, useTheme, mergeStyleSets } from "@fluentui/react";
import HelpCircleOutlineIcon from "@mdi/svg/svg/help-circle-outline.svg";
import HelpCircleIcon from "@mdi/svg/svg/help-circle.svg";
import { useState, useMemo } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import TextContent from "@foxglove/studio-base/components/TextContent";

const styles = mergeStyleSets({
  icon: { fontSize: 14, margin: "0 0.2em" },
});

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

  const trailingItemsWithHelp = useMemo(() => {
    if (helpContent != undefined) {
      const IconComponent = showHelp ? HelpCircleIcon : HelpCircleOutlineIcon;
      const tooltipText = showHelp ? "Hide help" : "Show help";
      return [
        ...(trailingItems ?? []),
        <Icon key="icon" tooltip={tooltipText} fade onClick={() => setShowHelp(!showHelp)}>
          <IconComponent className={styles.icon} style={{ width: "18px", height: "18px" }} />
        </Icon>,
      ];
    }
    return trailingItems ?? [];
  }, [showHelp, helpContent, trailingItems]);

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
        style={{ padding: theme.spacing.m }}
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
        <Stack style={{ margin: "0px", padding: theme.spacing.m, paddingTop: "0px" }}>
          <TextContent allowMarkdownHtml={true}>{helpContent}</TextContent>
        </Stack>
      ) : undefined}
      <Stack.Item
        style={{
          padding: noPadding ? undefined : `0px ${theme.spacing.m} ${theme.spacing.m}`,
        }}
        grow
      >
        {children}
      </Stack.Item>
    </Stack>
  );
}
