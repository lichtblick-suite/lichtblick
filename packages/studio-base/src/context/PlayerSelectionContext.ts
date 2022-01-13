// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { Player, PlayerMetricsCollectorInterface } from "@foxglove/studio-base/players/types";
import ConsoleApi from "@foxglove/studio-base/services/ConsoleApi";

export type DataSourceFactoryInitializeArgs = {
  metricsCollector: PlayerMetricsCollectorInterface;
  unlimitedMemoryCache: boolean;
  folder?: FileSystemDirectoryHandle;
  file?: File;
  files?: File[];
  url?: string;
  consoleApi?: ConsoleApi;
} & Record<string, unknown>;

export type DataSourceFactoryType = "file" | "remote-file" | "connection" | "sample";

export interface IDataSourceFactory {
  id: string;
  type: DataSourceFactoryType;
  displayName: string;
  iconName?: RegisteredIconNames;
  disabledReason?: string | JSX.Element;
  badgeText?: string;
  hidden?: boolean;

  sampleLayout?: PanelsState;

  formConfig?: {
    // Initialization args are populated with keys of the _id_ field
    fields: { id: string; label: string; defaultValue?: string; placeholder?: string }[];
  };

  // If data source initialization supports "Open File" workflow, this property lists the supported
  // file types
  supportedFileTypes?: string[];

  supportsMultiFile?: boolean;

  // Initialize a player.
  initialize: (args: DataSourceFactoryInitializeArgs) => Player | undefined;
}

/**
 * Recently selected source information
 *
 * The _id_ is opaque and up to the PlayerSelectionContext implementation.
 */
export type RecentSource = {
  id: string;
  title: string;
  label?: string;
};

// File data sources accept either file instances or handles
type FileDataSourceArgs = {
  type: "file";
  files?: File[];
  handle?: FileSystemFileHandle;
};

type ConnectionDataSourceArgs = {
  type: "connection";
  params?: Record<string, string | undefined>;
};

export type DataSourceArgs = FileDataSourceArgs | ConnectionDataSourceArgs;

/**
 * PlayerSelectionContext exposes the available data sources and a function to set the current data source
 */
export interface PlayerSelection {
  selectSource: (sourceId: string, args?: DataSourceArgs) => void;
  selectRecent: (recentId: string) => void;

  /** Currently selected data source */
  selectedSource?: IDataSourceFactory;

  /** List of available data sources */
  availableSources: IDataSourceFactory[];

  /** Recently selected sources */
  recentSources: RecentSource[];
}

const PlayerSelectionContext = createContext<PlayerSelection>({
  selectSource: () => {},
  selectRecent: () => {},
  availableSources: [],
  recentSources: [],
});

export function usePlayerSelection(): PlayerSelection {
  return useContext(PlayerSelectionContext);
}

export default PlayerSelectionContext;
