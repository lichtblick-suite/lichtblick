// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Add20Filled, Edit20Filled, Heart20Filled, Toolbox20Filled } from "@fluentui/react-icons";
import { Fab, FabProps, Stack } from "@mui/material";
import { Meta, StoryObj } from "@storybook/react";

const variants: FabProps["variant"][] = ["circular", "extended"];
const sizes: FabProps["size"][] = ["small", "medium", "large"];
const colors: FabProps["color"][] = [
  "inherit",
  "primary",
  "secondary",
  "success",
  "error",
  "info",
  "warning",
];

export default {
  component: Fab,
  title: "Theme/Inputs/Floating Action Button",
  decorators: [
    (Story) => {
      return (
        <Stack direction="row" padding={2} gap={2} justifyContent="center" alignItems="center">
          <Story />
        </Stack>
      );
    },
  ],
  parameters: {
    colorScheme: "both-column",
  },
} satisfies Meta<typeof Fab>;

export const Default: StoryObj = {
  render: () => (
    <>
      <Fab color="primary" aria-label="add">
        <Add20Filled />
      </Fab>
      <Fab color="secondary" aria-label="edit">
        <Edit20Filled />
      </Fab>
      <Fab variant="extended">
        <Toolbox20Filled />
        Tools
      </Fab>
      <Fab disabled aria-label="like">
        <Heart20Filled />
      </Fab>
    </>
  ),
};

export const Colors: StoryObj = {
  render: () => (
    <>
      {colors.map((color) => (
        <Fab key={color} color={color} aria-label={color}>
          <Add20Filled />
        </Fab>
      ))}
    </>
  ),
};

export const SizesAndVariants: StoryObj = {
  render: () => (
    <Stack gap={2} alignItems="center">
      {variants.map((variant) => (
        <Stack key={variant} direction="row" alignItems="center" gap={2}>
          {sizes.map((size) => (
            <Fab color="primary" key={size} {...{ size, variant }}>
              <Add20Filled />
              {variant === "extended" && "Extended"}
            </Fab>
          ))}
        </Stack>
      ))}
    </Stack>
  ),
};
