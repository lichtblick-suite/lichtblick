// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import OpenDialog, { OpenDialogProps } from "./OpenDialog";

export default {
  title: "components/OpenDialog/Connection",
  component: OpenDialog,
};

// Connection
const playerSelection: PlayerSelection = {
  selectSource: () => {},
  selectRecent: () => {},
  recentSources: [],
  availableSources: [
    {
      id: "foo",
      type: "connection",
      displayName: "My Data Source",
      description: "Data source description",
      iconName: "ROS",
      warning: "This is a warning",

      formConfig: {
        fields: [{ id: "key", label: "Some Label" }],
      },

      initialize: () => {
        return undefined;
      },
    },
    {
      id: "bar",
      type: "connection",
      displayName: "Another data source",
      description: "Another description (with default icon)",

      initialize: () => {
        return undefined;
      },
    },
    {
      id: "bar",
      type: "connection",
      displayName: "Another data source",
      description: "Another description (with default icon)",
      iconName: "GenericScan",

      initialize: () => {
        return undefined;
      },
    },
  ],
};

const defaultProps: OpenDialogProps = { activeView: "connection", backdropAnimation: false };

export const Light: StoryObj = {
  render: () => (
    <PlayerSelectionContext.Provider value={playerSelection}>
      <OpenDialog {...defaultProps} />
    </PlayerSelectionContext.Provider>
  ),

  name: "Default (light)",
  parameters: { colorScheme: "light" },
};

export const LightChinese: StoryObj = {
  ...Light,
  name: "Default Chinese",
  parameters: { forceLanguage: "zh" },
};

export const Dark: StoryObj = {
  render: () => (
    <PlayerSelectionContext.Provider value={playerSelection}>
      <OpenDialog {...defaultProps} />
    </PlayerSelectionContext.Provider>
  ),

  name: "Default (dark)",
  parameters: { colorScheme: "dark" },
};
