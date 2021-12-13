// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import OpenDialog from "./OpenDialog";

export default {
  component: OpenDialog,
  title: "components/OpenDialog",
};

export const Start = (): JSX.Element => <OpenDialog />;

export const Remote = (): JSX.Element => <OpenDialog activeView="remote" />;

export const Connection = (): JSX.Element => {
  const playerSelection: PlayerSelection = {
    selectSource: () => {},
    selectRecent: () => {},
    recentSources: [],
    availableSources: [
      {
        id: "foo",
        type: "connection",
        displayName: "My Data Source",

        formConfig: {
          fields: [{ id: "key", label: "Some Label" }],
        },

        initialize: () => {
          return undefined;
        },
      },
    ],
  };

  return (
    <PlayerSelectionContext.Provider value={playerSelection}>
      <OpenDialog activeView="connection" />
    </PlayerSelectionContext.Provider>
  );
};
