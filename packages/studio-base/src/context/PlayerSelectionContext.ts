// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { Player, PlayerMetricsCollectorInterface } from "@foxglove/studio-base/players/types";
import { RegisteredIconNames } from "@foxglove/studio-base/types/Icons";

export type DataSourceFactoryInitializeArgs = {
  metricsCollector: PlayerMetricsCollectorInterface;
  file?: File;
  files?: File[];
  params?: Record<string, string | undefined>;
};

export type DataSourceFactoryType = "file" | "connection" | "sample";

export type Field = {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  description?: string;

  /**
   * Optional validate function
   *
   * The function is called with a value and can return an Error if the value should
   * be rejected. If the function returns `undefined`, then the value is accepted.
   */
  validate?: (value: string) => Error | undefined;
};

export interface IDataSourceFactory {
  id: string;

  // A list of alternate ids used to identify this factory
  // https://github.com/foxglove/studio/issues/4937
  legacyIds?: string[];

  type: DataSourceFactoryType;
  displayName: string;
  iconName?: RegisteredIconNames;
  description?: string;
  docsLinks?: { label?: string; url: string }[];
  disabledReason?: string | JSX.Element;
  badgeText?: string;
  hidden?: boolean;
  warning?: string | JSX.Element;

  sampleLayout?: LayoutData;

  formConfig?: {
    // Initialization args are populated with keys of the _id_ field
    fields: Field[];
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
  handle?: FileSystemFileHandle; // foxglove-depcheck-used: @types/wicg-file-system-access
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
PlayerSelectionContext.displayName = "PlayerSelectionContext";

export function usePlayerSelection(): PlayerSelection {
  return useContext(PlayerSelectionContext);
}

export default PlayerSelectionContext;
