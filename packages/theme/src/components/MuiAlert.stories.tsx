// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AlertProps, AlertTitle, Alert as MuiAlert, Stack } from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";

const colors = ["error", "info", "success", "warning", "primary"] as AlertProps["color"][];

export default {
  component: MuiAlert,
  title: "Theme/Feedback/Alert",
  args: {
    showTitle: false,
  },
  decorators: [
    (_, { args: { showTitle, ...args } }) => (
      <Stack gap={2} padding={2}>
        {colors.map((color) => (
          <MuiAlert key={color} variant={args.variant} color={color}>
            {showTitle === true && <AlertTitle>{color}</AlertTitle>}
            This is a {color} alert — check it out!
          </MuiAlert>
        ))}
      </Stack>
    ),
  ],
} as Meta<AlertProps & { showTitle?: boolean }>;

type Story = StoryObj<AlertProps & { showTitle?: boolean }>;

export const StandardVariant: Story = {
  args: { variant: "standard" },
};

export const OutlinedVariant: Story = {
  args: { variant: "outlined" },
};

export const FilledVariant: Story = {
  args: { variant: "filled" },
};

export const Description: Story = {
  args: { showTitle: true },
};
