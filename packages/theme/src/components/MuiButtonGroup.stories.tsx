// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Button, ButtonGroup, ButtonProps, Stack } from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";

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
  component: ButtonGroup,
  title: "Theme/Inputs/Button Group",
  decorators: [
    (Story) => {
      return (
        <Stack padding={2} gap={2} alignItems="center">
          <Story />
        </Stack>
      );
    },
  ],
  parameters: {
    colorScheme: "both-column",
  },
} satisfies Meta<typeof ButtonGroup>;

const buttons = [
  <Button key="one">One</Button>,
  <Button key="two">Two</Button>,
  <Button key="three">Three</Button>,
];

export const Default: StoryObj = {
  args: {
    children: buttons,
  },
};

export const Variants: StoryObj = {
  render: () => (
    <>
      {variants.map((variant) => (
        <ButtonGroup key={variant} {...{ variant }} aria-label={`${variant} button group`}>
          {buttons}
        </ButtonGroup>
      ))}
    </>
  ),
};

export const Colors: StoryObj = {
  render: () => (
    <>
      {colors.map((color) => (
        <ButtonGroup
          key={color}
          {...{ color }}
          variant="contained"
          aria-label={`${color} button group`}
        >
          {buttons}
        </ButtonGroup>
      ))}
    </>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <>
      {sizes.map((size) => (
        <ButtonGroup key={size} {...{ size }} aria-label={`${size} button group`}>
          {buttons}
        </ButtonGroup>
      ))}
    </>
  ),
};

export const Orientation: StoryObj = {
  render: () => (
    <Stack direction="row" gap={2}>
      {variants.map((variant) => (
        <ButtonGroup
          orientation="vertical"
          key={variant}
          {...{ variant }}
          aria-label={`${variant} button group`}
        >
          {buttons}
        </ButtonGroup>
      ))}
    </Stack>
  ),
};

export const SplitButton: StoryObj = {
  render: () => (
    <>
      {variants.map((variant) => (
        <ButtonGroup key={variant} {...{ variant }} aria-label={`${variant} button group`}>
          <Button>Squash and merge</Button>
          <Button size="small">
            <ArrowDropDownIcon />
          </Button>
        </ButtonGroup>
      ))}
    </>
  ),
};

export const DisableElevation: StoryObj = {
  args: {
    disableElevation: true,
    children: buttons,
    variant: "contained",
  },
};
