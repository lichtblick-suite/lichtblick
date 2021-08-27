// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, Text, useTheme } from "@fluentui/react";

import HelpButton from "@foxglove/studio-base/components/PanelToolbar/HelpButton";

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

  let trailingItemsWithHelp = trailingItems;

  if (helpContent != undefined) {
    (trailingItemsWithHelp ??= []).push(
      <HelpButton iconStyle={{ width: "18px", height: "18px" }}>{helpContent}</HelpButton>,
    );
  }

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
        padding: noPadding ? undefined : theme.spacing.m,
      }}
    >
      <Stack
        horizontal
        horizontalAlign="space-between"
        verticalAlign="center"
        style={{
          padding: noPadding ? theme.spacing.m : undefined,
          paddingBottom: theme.spacing.m,
        }}
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
        {trailingItemsWithHelp && (
          <Stack horizontal verticalAlign="center">
            {trailingItemsWithHelp.map((item, i) => (
              <Stack.Item key={i}>{item}</Stack.Item>
            ))}
          </Stack>
        )}
      </Stack>
      <Stack.Item grow>{children}</Stack.Item>
    </Stack>
  );
}
