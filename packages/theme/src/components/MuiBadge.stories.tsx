// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert24Filled } from "@fluentui/react-icons";
import { BadgeProps, Badge as MuiBadge, Stack } from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";

const colors: BadgeProps["color"][] = [
  "default",
  "primary",
  "secondary",
  "error",
  "info",
  "success",
  "warning",
];

export default {
  component: MuiBadge,
  title: "Theme/Data Display/Badge",
  args: {
    badgeContent: 4,
    children: <Alert24Filled />,
  },
  decorators: [
    (Story) => (
      <Stack direction="row" gap={2} padding={2}>
        <Story />
      </Stack>
    ),
  ],
} as Meta<typeof MuiBadge>;

export const Default: StoryObj = {
  render: (args) => (
    <>
      {colors.map((color) => (
        <MuiBadge key={color} {...{ ...args, color }} />
      ))}
    </>
  ),
};
