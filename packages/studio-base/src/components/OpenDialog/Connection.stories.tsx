// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import OpenDialog from "./OpenDialog";

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
  ],
};

export const Light = (): JSX.Element => (
  <PlayerSelectionContext.Provider value={playerSelection}>
    <OpenDialog activeView="connection" />
  </PlayerSelectionContext.Provider>
);
Light.storyName = "Default (light)";
Light.parameters = { colorScheme: "light" };

export const Dark = (): JSX.Element => (
  <PlayerSelectionContext.Provider value={playerSelection}>
    <OpenDialog activeView="connection" />
  </PlayerSelectionContext.Provider>
);
Dark.storyName = "Default (dark)";
Dark.parameters = { colorScheme: "dark" };
