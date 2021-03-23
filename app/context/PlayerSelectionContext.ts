// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import type OrderedStampPlayer from "@foxglove-studio/app/players/OrderedStampPlayer";

export type PlayerSourceDefinition = {
  name: string;
  type: "file" | "ws" | "http";
};

// PlayerSelection provides the user with a select function and the items to select
export interface PlayerSelection {
  selectSource: (definition: PlayerSourceDefinition) => void;
  setPlayerFromDemoBag: () => Promise<void>;
  availableSources: PlayerSourceDefinition[];
  currentSourceName?: string;
  currentPlayer?: OrderedStampPlayer;
}

const PlayerSelectionContext = createContext<PlayerSelection>({
  selectSource: () => {},
  setPlayerFromDemoBag: async () => {},
  availableSources: [],
});

export function usePlayerSelection(): PlayerSelection {
  return useContext(PlayerSelectionContext);
}

export default PlayerSelectionContext;
