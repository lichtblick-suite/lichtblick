// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import type {
  MosaicNode as OrigMosaicNode,
  MosaicPath,
  MosaicBranch,
  MosaicDirection,
} from "react-mosaic-component";

import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import { LinkedGlobalVariables } from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { PanelsState } from "@foxglove-studio/app/reducers/panels";
import { TimestampMethod } from "@foxglove-studio/app/util/time";

// Mosaic Types
export type MosaicKey = string | number;
export type MosaicDropTargetPosition = "top" | "bottom" | "left" | "right";
export type { MosaicPath, MosaicBranch, MosaicDirection };
export type MosaicNode = OrigMosaicNode<string>;

export type PanelConfig = {
  [key: string]: any;
};
export type PerPanelFunc<Config> = (arg0: Config) => Config;

export type PlaybackConfig = {
  speed: number;
  messageOrder: TimestampMethod;
  timeDisplayMethod: "ROS" | "TOD";
};

export type UserNode = { name: string; sourceCode: string };
export type UserNodes = {
  [nodeId: string]: UserNode;
};

// May want finer-grained controls in the future, currently just a boolean "suppress" condition.
// Unused, but should be used for intermediate states like during a panel move when the panel isn't
// present in the layout.
export type EditHistoryOptions = "SUPPRESS_HISTORY_ENTRY";

export type ConfigsPayload = {
  id: string;
  override?: boolean;
  config: PanelConfig;
  defaultConfig?: PanelConfig;
};
export type ChangePanelLayoutPayload = {
  layout?: MosaicNode;
  trimSavedProps?: boolean;
  historyOptions?: EditHistoryOptions;
};
export type SaveConfigsPayload = {
  // if you set override to true, existing config will be completely overriden by new passed in config
  configs: ConfigsPayload[];
  historyOptions?: EditHistoryOptions;
};

export type SaveFullConfigPayload = {
  panelType: string;
  perPanelFunc: PerPanelFunc<any>;
  historyOptions?: EditHistoryOptions;
};

export type SavedProps = {
  [panelId: string]: PanelConfig;
};

export type CreateTabPanelPayload = {
  idToReplace?: string;
  layout: MosaicNode;
  idsToRemove: string[];
  singleTab: boolean;
};

export type ImportPanelLayoutPayload = {
  // layout is the object passed to react-mosaic
  layout?: MosaicNode;
  savedProps?: SavedProps;
  globalVariables?: GlobalVariables;
  userNodes?: UserNodes;
  linkedGlobalVariables?: LinkedGlobalVariables;
  skipSettingLocalStorage?: boolean;
};

export type LayoutFetchResult = {
  content: PanelsState;
  name: string;
  savedBy: string;
  releasedVersion: number;
  fileSuffix?: string;
};
export type LayoutUrl = {
  layoutId?: string;
  layoutUrl?: string;
  patch?: string;
};
export type InitialLayoutFetchResult = {
  layoutUrlReplacedByDefault?: LayoutUrl;
  // The layoutFetchResult will be undefined if there is no layout to load in the URL.
  layoutFetchResult?: LayoutFetchResult;
};
export type SetFetchedLayoutPayload = {
  isLoading: boolean;
  error?: Error;
  data?: LayoutFetchResult;
  isFromLayoutUrlParam?: boolean;
  isInitializedFromLocalStorage?: boolean;
  layoutUrlReplacedByDefault?: LayoutUrl;
};

export type SaveConfig<Config> = (
  arg0: Partial<Config>,
  arg1?: { historyOptions?: EditHistoryOptions },
) => void;

export type UpdatePanelConfig<Config> = (
  panelType: string,
  perPanelFunc: PerPanelFunc<Config>,
  historyOptions?: EditHistoryOptions,
) => void;

export type OpenSiblingPanel = (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;
