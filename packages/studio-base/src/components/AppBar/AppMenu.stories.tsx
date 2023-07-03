// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Meta, StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/testing-library";

import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { AppMenu } from "./AppMenu";

export default {
  title: "components/AppBar/AppMenu",
  component: (): JSX.Element => (
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
  decorators: [
    (Story: StoryFn): JSX.Element => (
      <WorkspaceContextProvider>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <Story />
        </PlayerSelectionContext.Provider>
      </WorkspaceContextProvider>
    ),
  ],
  play: async ({ canvasElement, args }) => {
    if (args.id == undefined) {
      return;
    }
    const canvas = within(canvasElement);
    await userEvent.hover(await canvas.findByTestId(args.id));
  },
} as Meta<{ id?: string }>;

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

type AppMenuStory = StoryObj<{ id?: string }>;

export const Default: AppMenuStory = {};

export const FileMenuDark: AppMenuStory = {
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "dark" },
};

export const FileMenuDarkChinese: AppMenuStory = {
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "dark", forceLanguage: "zh" },
};

export const FileMenuDarkJapanese: AppMenuStory = {
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "dark", forceLanguage: "ja" },
};

export const FileMenuLight: AppMenuStory = {
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "light" },
};

export const FileMenuLightChinese: AppMenuStory = {
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const FileMenuLightJapanese: AppMenuStory = {
  args: { id: "app-menu-file" },
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};

export const ViewMenuDark: AppMenuStory = {
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "dark" },
};

export const ViewMenuDarkChinese: AppMenuStory = {
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "dark", forceLanguage: "zh" },
};

export const ViewMenuDarkJapanese: AppMenuStory = {
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "dark", forceLanguage: "ja" },
};

export const ViewMenuLight: AppMenuStory = {
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "light" },
};

export const ViewMenuLightChinese: AppMenuStory = {
  args: { id: "app-menu-view" },
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const ViewMenuLightJapanese: AppMenuStory = {
  ...ViewMenuLight,
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};

export const HelpMenuDark: AppMenuStory = {
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "dark" },
};

export const HelpMenuDarkChinese: AppMenuStory = {
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "dark", forceLanguage: "zh" },
};

export const HelpMenuDarkJapanese: AppMenuStory = {
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "dark", forceLanguage: "ja" },
};

export const HelpMenuLight: AppMenuStory = {
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "light" },
};

export const HelpMenuLightChinese: AppMenuStory = {
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "light", forceLanguage: "zh" },
};

export const HelpMenuLightJapanese: AppMenuStory = {
  args: { id: "app-menu-help" },
  parameters: { colorScheme: "light", forceLanguage: "ja" },
};
