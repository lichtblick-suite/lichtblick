// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Home20Regular,
  Grid20Regular,
  RecordStop20Regular,
  LineStyle20Regular,
  BookStar20Regular,
} from "@fluentui/react-icons";
import { Meta, StoryObj } from "@storybook/react";
import * as _ from "lodash-es";

import { AppBarMenuItem } from "@foxglove/studio-base/components/AppBar/types";
import { AppContext } from "@foxglove/studio-base/context/AppContext";
import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { BetaAppMenu, BetaAppMenuProps } from "./BetaAppMenu";

type StoryArgs = {
  appBarMenuItems?: AppBarMenuItem[];
  recentSources?: PlayerSelection["recentSources"];
} & BetaAppMenuProps;

type Story = StoryObj<StoryArgs>;

// Connection
const playerSelection: PlayerSelection = {
  selectSource: () => {},
  selectRecent: () => {},
  recentSources: [],
  availableSources: [],
};

export default {
  title: "beta/components/AppMenu",
  component: BetaAppMenu,
  args: {
    open: true,
    anchorPosition: { top: 0, left: 0 },
    anchorReference: "anchorPosition",
    disablePortal: true,
    handleClose: _.noop,
  },
  decorators: [
    (Story, { args: { appBarMenuItems, recentSources = [], ...args } }): JSX.Element => (
      <AppContext.Provider value={{ appBarMenuItems }}>
        <MockCurrentLayoutProvider>
          <WorkspaceContextProvider>
            <PlayerSelectionContext.Provider value={{ ...playerSelection, recentSources }}>
              <Story {...args} />
            </PlayerSelectionContext.Provider>
          </WorkspaceContextProvider>
        </MockCurrentLayoutProvider>
      </AppContext.Provider>
    ),
  ],
} satisfies Meta<StoryArgs>;

export const Default: Story = {};

export const DefaultChinese: Story = {
  parameters: { forceLanguage: "zh" },
};

export const DefaultJapanese: Story = {
  parameters: { forceLanguage: "ja" },
};

const mockSources = [
  // prettier-ignore
  { id: "1111", title: "NuScenes-v1.0-mini-scene-0655-reallllllllly-long-name-8829908290831091.mcap", },
  { id: "2222", title: "http://localhost:11311", label: "ROS 1" },
  { id: "3333", title: "ws://localhost:9090/", label: "Rosbridge (ROS 1 & 2)" },
  { id: "4444", title: "ws://localhost:8765", label: "Foxglove WebSocket" },
  { id: "5555", title: "2369", label: "Velodyne Lidar" },
  { id: "6666", title: "THIS ITEM SHOULD BE HIDDEN IN STORYBOOKS", label: "!!!!!!!!!!!!" },
];

export const WithRecents: Story = {
  args: {
    recentSources: mockSources,
  },
};

export const WithRecentsChinese: Story = {
  ...WithRecents,
  parameters: { forceLanguage: "zh" },
};

export const WithRecentsJapanese: Story = {
  ...WithRecents,
  parameters: { forceLanguage: "ja" },
};

export const WithAppContextMenuItems: Story = {
  args: {
    appBarMenuItems: [
      { type: "subheader", key: "recent", label: "Browse" },
      { external: true, type: "item", key: "home", icon: <Home20Regular />, label: "Home" },
      { external: true, type: "item", key: "devices", icon: <Grid20Regular />, label: "Devices" },
      {
        external: true,
        type: "item",
        key: "recordings",
        icon: <RecordStop20Regular />,
        label: "Recordings",
      },
      {
        external: true,
        type: "item",
        key: "timeline",
        icon: <LineStyle20Regular />,
        label: "Timeline",
      },
      {
        type: "divider",
      },
      {
        type: "item",
        key: "demo",
        icon: <BookStar20Regular />,
        label: "Explore Sample Data",
      },
    ],
    recentSources: mockSources,
  },
};
