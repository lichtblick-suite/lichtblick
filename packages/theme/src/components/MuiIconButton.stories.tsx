// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ClockAlarm20Regular,
  Delete12Regular,
  Delete16Regular,
  Delete20Regular,
  Delete28Regular,
  Fingerprint20Regular,
  ShoppingBag20Regular,
} from "@fluentui/react-icons";
import { IconButtonProps, IconButton as MuiIconButton, Stack } from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";

const colors: IconButtonProps["color"][] = [
  "inherit",
  "primary",
  "secondary",
  "success",
  "error",
  "info",
  "warning",
];

export default {
  component: MuiIconButton,
  title: "Theme/Inputs/Icon Button",
  args: {},
} as Meta<typeof MuiIconButton>;

export const Default: StoryObj = {
  render: () => (
    <Stack direction="row" justifyContent="center" alignItems="center" padding={2}>
      <MuiIconButton aria-label="delete">
        <Delete20Regular />
      </MuiIconButton>
      <MuiIconButton aria-label="delete" disabled color="primary">
        <Delete20Regular />
      </MuiIconButton>
      <MuiIconButton color="secondary" aria-label="add an alarm">
        <ClockAlarm20Regular />
      </MuiIconButton>
      <MuiIconButton color="primary" aria-label="add to shopping cart">
        <ShoppingBag20Regular />
      </MuiIconButton>
    </Stack>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <Stack direction="row" justifyContent="center" alignItems="center" padding={2}>
      <MuiIconButton aria-label="delete" size="small">
        <Delete12Regular />
      </MuiIconButton>
      <MuiIconButton aria-label="delete" size="small">
        <Delete16Regular />
      </MuiIconButton>
      <MuiIconButton aria-label="delete" size="large">
        <Delete20Regular />
      </MuiIconButton>
      <MuiIconButton aria-label="delete" size="large">
        <Delete28Regular />
      </MuiIconButton>
    </Stack>
  ),
};

export const Color: StoryObj = {
  render: () => (
    <Stack direction="row" justifyContent="center" alignItems="center" padding={2}>
      {colors.map((color) => (
        <MuiIconButton {...{ color }} key={color}>
          <Fingerprint20Regular />
        </MuiIconButton>
      ))}
    </Stack>
  ),
};
