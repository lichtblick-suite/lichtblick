// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

type SourceTypes =
  | "ros1-local-bagfile"
  | "ros2-local-bagfile"
  | "ros1-socket"
  | "ros1-rosbridge-websocket"
  | "ros2-rosbridge-websocket"
  | "ros1-remote-bagfile"
  | "velodyne-device";

export type PlayerSourceDefinition = {
  name: string;
  type: SourceTypes;
  disabledReason?: string | JSX.Element;
};

type FileSourceParams = {
  files?: File[];
};

type FolderSourceParams = {
  folder?: string;
};

type HttpSourceParams = {
  url?: string;
};

type SpecializedPlayerSource<T extends SourceTypes> = Omit<PlayerSourceDefinition, "type"> & {
  type: T;
};

interface SelectSourceFunction {
  (definition: SpecializedPlayerSource<"ros1-local-bagfile">, params?: FileSourceParams): void;
  (definition: SpecializedPlayerSource<"ros2-local-bagfile">, params?: FolderSourceParams): void;
  (definition: SpecializedPlayerSource<"ros1-remote-bagfile">, params?: HttpSourceParams): void;
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
