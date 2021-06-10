// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, Text, useTheme } from "@fluentui/react";

import HelpButton from "@foxglove/studio-base/components/PanelToolbar/HelpButton";

export function SidebarContent({
  noPadding = false,
  paddingLeft,
  title,
  children,
  helpContent,
}: React.PropsWithChildren<{
  title: string;
  helpContent?: React.ReactNode;
  noPadding?: boolean;
  paddingLeft?: string;
}>): JSX.Element {
  const theme = useTheme();
  return (
    <Stack
      verticalFill
      style={{
        padding: noPadding ? undefined : theme.spacing.m,
        maxHeight: "100%",
        overflow: "auto",
      }}
      tokens={{ childrenGap: theme.spacing.s1 }}
    >
      <Stack
        horizontal
        horizontalAlign="space-between"
        style={{
          padding: noPadding ? theme.spacing.m : undefined,
          paddingBottom: theme.spacing.m,
          paddingLeft,
        }}
      >
        <Text as="h2" variant="xLarge">
          {title}
        </Text>
        {Boolean(helpContent) && (
          <HelpButton iconStyle={{ width: "18px", height: "18px" }}>{helpContent}</HelpButton>
        )}
      </Stack>
      <Stack.Item>{children}</Stack.Item>
    </Stack>
  );
}
