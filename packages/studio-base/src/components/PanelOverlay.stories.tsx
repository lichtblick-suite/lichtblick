// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Delete20Regular,
  TabDesktop20Regular,
  TabDesktopMultiple20Regular,
  TableSimple20Regular,
} from "@fluentui/react-icons";
import { Meta, StoryFn, StoryObj } from "@storybook/react";

import Stack from "@foxglove/studio-base/components/Stack";

import { PanelOverlay } from "./PanelOverlay";

export default {
  title: "components/PanelOverlay",
  component: PanelOverlay,
  decorators: [],
  render: (args) => {
    return (
      <Stack
        flex="auto"
        position="relative"
        justifyContent="center"
        alignItems="center"
        paddingTop={3.75}
      >
        <PanelOverlay {...args} />
        Background content
      </Stack>
    );
  },
} as Meta<typeof PanelOverlay>;

type Story = StoryObj<typeof PanelOverlay>;

export const Default: Story = {};

export const ValidDropTarget: Story = {
  args: {
    open: true,
    variant: "validDropTarget",
    dropMessage: "View /topic_name/field_name",
  },
};

export const InvalidDropTarget: Story = {
  args: {
    open: true,
    variant: "invalidDropTarget",
    dropMessage: "View /topic_name/field_name",
  },
};

export const SelectedPanelActions: Story = {
  args: {
    open: true,
    variant: "selected",
    actions: [
      { key: "group", text: "Group in tab", icon: <TabDesktop20Regular /> },
      { key: "create-tabs", text: "Create tabs", icon: <TabDesktopMultiple20Regular /> },
    ],
  },
  parameters: {
    colorScheme: "both-column",
  },
  decorators: [
    (Story: StoryFn): JSX.Element => (
      <Stack fullHeight gap={1}>
        <Story />
        <div
          style={{
            height: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 260px 100px",
            gap: 8,
          }}
        >
          <Story />
          <Story />
          <Story />
        </div>
      </Stack>
    ),
  ],
};

export const QuickActions: Story = {
  args: {
    open: true,
    variant: "selected",
    actions: [
      { key: "split", text: "Split panel", icon: <TableSimple20Regular /> },
      { key: "remove", text: "Remove panel", icon: <Delete20Regular />, color: "error" },
    ],
  },
  parameters: {
    colorScheme: "both-column",
  },
  decorators: [
    (Story: StoryFn): JSX.Element => (
      <Stack fullHeight gap={1}>
        <Story />
        <div
          style={{
            height: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 260px auto",
            gap: 8,
          }}
        >
          <Story />
          <Story />
          <Story />
        </div>
      </Stack>
    ),
  ],
};
