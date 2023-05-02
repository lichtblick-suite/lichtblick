// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";

import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { AppMenu } from "./AppMenu";

export default {
  title: "components/AppBar/AppMenu",
  component: AppMenu,
  decorators: [
    (Story: StoryFn): JSX.Element => (
      <WorkspaceContextProvider>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <Story />
        </PlayerSelectionContext.Provider>
      </WorkspaceContextProvider>
    ),
  ],
};

// Connection
const playerSelection: PlayerSelection = {
  selectSource: () => {},
  selectRecent: () => {},
  recentSources: [
    // prettier-ignore
    { id: "1111", title: "NuScenes-v1.0-mini-scene-0655-reallllllllly-long-name-8829908290831091.bag", },
    { id: "2222", title: "http://localhost:11311", label: "ROS 1" },
    { id: "3333", title: "ws://localhost:9090/", label: "Rosbridge (ROS 1 & 2)" },
    { id: "4444", title: "ws://localhost:8765", label: "Foxglove WebSocket" },
    { id: "5555", title: "2369", label: "Velodyne Lidar" },
    { id: "6666", title: "THIS ITEM SHOULD BE HIDDEN IN STORYBOOKS", label: "!!!!!!!!!!!!" },
  ],
  availableSources: [],
};

export const Default: StoryObj = {
  render: () => (
    <AppMenu
      open
      anchorPosition={{ top: 0, left: 0 }}
      anchorReference="anchorPosition"
      disablePortal
      handleClose={() => {
        // no-op
      }}
    />
  ),
};

const Selected: StoryObj<{ id: string }> = {
  ...Default,
  play: async ({ args: { id } }) => {
    userEvent.hover(screen.getByTestId(id));
  },
};

export const FileMenuDark = {
  ...Selected,
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "dark" },
};

export const FileMenuDarkChinese = {
  ...Selected,
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "dark", forceLanguage: "zh" },
};

export const FileMenuDarkJapanese = {
  ...Selected,
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "dark", forceLanguage: "ja" },
};

export const FileMenuLight = {
  ...Selected,
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "light" },
};

export const FileMenuLightChinese = {
  ...Selected,
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const FileMenuLightJapanese = {
  ...Selected,
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};

export const ViewMenuDark = {
  ...Selected,
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "dark" },
};

export const ViewMenuDarkChinese = {
  ...Selected,
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "dark", forceLanguage: "zh" },
};

export const ViewMenuDarkJapanese = {
  ...Selected,
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "dark", forceLanguage: "ja" },
};

export const ViewMenuLight = {
  ...Selected,
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "light" },
};

export const ViewMenuLightChinese = {
  ...Selected,
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const ViewMenuLightJapanese = {
  ...Selected,
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};

export const HelpMenuDark = {
  ...Selected,
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "dark" },
};

export const HelpMenuDarkChinese = {
  ...Selected,
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "dark", forceLanguage: "zh" },
};

export const HelpMenuDarkJapanese = {
  ...Selected,
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "dark", forceLanguage: "ja" },
};

export const HelpMenuLight = {
  ...Selected,
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "light" },
};

export const HelpMenuLightChinese = {
  ...Selected,
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const HelpMenuLightJapanese = {
  ...Selected,
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};
