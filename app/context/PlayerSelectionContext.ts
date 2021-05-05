// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

type SourceTypes = "file" | "ros1-core" | "ws" | "http";

export type PlayerSourceDefinition = {
  name: string;
  type: SourceTypes;
};

type FileSourceParams = {
  files?: File[];
  append?: boolean;
};

type HttpSourceParams = {
  url?: string;
};

type SpecializedPlayerSource<T extends SourceTypes> = Omit<PlayerSourceDefinition, "type"> & {
  type: T;
};

interface SelectSourceFunction {
  (definition: SpecializedPlayerSource<"file">, params?: FileSourceParams): void;
  (definition: SpecializedPlayerSource<"http">, params?: HttpSourceParams): void;
  (definition: PlayerSourceDefinition, params?: never): void;
}

// PlayerSelection provides the user with a select function and the items to select
export interface PlayerSelection {
  selectSource: SelectSourceFunction;
  availableSources: PlayerSourceDefinition[];
  currentSourceName?: string;
}

const PlayerSelectionContext = createContext<PlayerSelection>({
  selectSource: () => {},
  availableSources: [],
});

export function usePlayerSelection(): PlayerSelection {
  return useContext(PlayerSelectionContext);
}

export default PlayerSelectionContext;
