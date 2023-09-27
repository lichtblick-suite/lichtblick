// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Delete20Regular, Send20Filled } from "@fluentui/react-icons";
import { Button, ButtonProps, Stack } from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";
import { Fragment } from "react";

const variants: ButtonProps["variant"][] = ["text", "outlined", "contained"];
const sizes: ButtonProps["size"][] = ["small", "medium", "large"];
const colors: ButtonProps["color"][] = [
  "inherit",
  "primary",
  "secondary",
  "success",
  "error",
  "info",
  "warning",
];

export default {
  component: Button,
  title: "Theme/Inputs/Button",
  decorators: [
    (Story) => {
      return (
        <Stack direction="row" padding={2} gap={1} justifyContent="center" alignItems="center">
          <Story />
        </Stack>
      );
    },
  ],
  parameters: {
    colorScheme: "both-column",
  },
} satisfies Meta<typeof Button>;

export const Default: StoryObj = {
  render: () => (
    <>
      <Button variant="text">Text</Button>
      <Button variant="contained">Contained</Button>
      <Button variant="outlined">Outlined</Button>
    </>
  ),
};

export const TextButton: StoryObj = {
  render: () => (
    <>
      <Button>Primary</Button>
      <Button disabled>Disabled</Button>
      <Button href="#text-buttons" target="_self">
        Link
      </Button>
    </>
  ),
};

export const ContainedButton: StoryObj = {
  render: () => (
    <>
      <Button variant="contained">Contained</Button>
      <Button variant="contained" disabled>
        Disabled
      </Button>
      <Button variant="contained" href="#contained-buttons" target="_self">
        Link
      </Button>
    </>
  ),
};

export const DisableElevation: StoryObj = {
  args: {
    disableElevation: true,
    variant: "contained",
    children: "Disable Elevation",
  },
};

export const OutlinedButton: StoryObj = {
  render: () => (
    <>
      <Button variant="outlined">Primary</Button>
      <Button variant="outlined" disabled>
        Disabled
      </Button>
      <Button variant="outlined" href="#outlined-buttons" target="_self">
        Link
      </Button>
    </>
  ),
};

export const Color: StoryObj = {
  render: () => (
    <Stack sx={{ display: "grid", gridTemplateColumns: `repeat(${colors.length}, auto)`, gap: 1 }}>
      {variants.map((variant) => (
        <Fragment key={variant}>
          {colors.map((color) => (
            <Button {...{ color, variant }} key={color}>
              {color}
            </Button>
          ))}
        </Fragment>
      ))}
    </Stack>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <Stack gap={2}>
      {variants.map((variant) => (
        <Stack key={variant} direction="row" alignItems="center" gap={2}>
          {sizes.map((size) => (
            <Button {...{ size, variant }} key={size}>
              {size}
            </Button>
          ))}
        </Stack>
      ))}
    </Stack>
  ),
};

export const ButtonsWithIcons: StoryObj = {
  render: () => (
    <>
      <Button variant="outlined" startIcon={<Delete20Regular />}>
        Delete
      </Button>
      <Button variant="contained" endIcon={<Send20Filled />}>
        Send
      </Button>
    </>
  ),
};
