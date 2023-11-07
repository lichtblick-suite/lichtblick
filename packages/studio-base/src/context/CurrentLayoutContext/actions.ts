// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { MosaicNode, MosaicPath } from "react-mosaic-component";

import { VariableValue } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { TabLocation } from "@foxglove/studio-base/types/layouts";
import {
  UserScripts,
  PlaybackConfig,
  SavedProps,
  PanelConfig,
  MosaicDropTargetPosition,
} from "@foxglove/studio-base/types/panels";

export type LayoutData = {
  // We store config for each panel in an object keyed by the panel id.
  configById: SavedProps;
  layout?: MosaicNode<string>;
  globalVariables: GlobalVariables;
  playbackConfig: PlaybackConfig;
  userNodes: UserScripts;
  /** @deprecated renamed to configById */
  savedProps?: SavedProps;
  /**
   * Optional version number. Set this to prevent older incompatible versions of
   * studio trying to load and possibly corrupt the layout.
   */
  version?: number;
};

export type ConfigsPayload = {
  id: string;
  // if you set override to true, existing config will be completely overriden by new passed in config
  override?: boolean;
  config: PanelConfig;
  defaultConfig?: PanelConfig;
};
export type ChangePanelLayoutPayload = {
  layout?: MosaicNode<string>;
  trimConfigById?: boolean;
};
export type SaveConfigsPayload = {
  configs: ConfigsPayload[];
};

type PerPanelFunc<Config> = (arg0: Config) => Config;
export type SaveFullConfigPayload = {
  panelType: string;
  perPanelFunc: PerPanelFunc<PanelConfig>;
};

export type CreateTabPanelPayload = {
  idToReplace?: string;
  layout: MosaicNode<string>;
  idsToRemove: readonly string[];
  singleTab: boolean;
};

export type SAVE_PANEL_CONFIGS = { type: "SAVE_PANEL_CONFIGS"; payload: SaveConfigsPayload };
export type SAVE_FULL_PANEL_CONFIG = {
  type: "SAVE_FULL_PANEL_CONFIG";
  payload: SaveFullConfigPayload;
};
export type CREATE_TAB_PANEL = { type: "CREATE_TAB_PANEL"; payload: CreateTabPanelPayload };
export type CHANGE_PANEL_LAYOUT = {
  type: "CHANGE_PANEL_LAYOUT";
  payload: ChangePanelLayoutPayload;
};

export type OVERWRITE_GLOBAL_DATA = {
  type: "OVERWRITE_GLOBAL_DATA";
  payload: Record<string, VariableValue>;
};

export type SET_GLOBAL_DATA = {
  type: "SET_GLOBAL_DATA";
  payload: Record<string, VariableValue>;
};

export type SET_STUDIO_NODES = { type: "SET_USER_NODES"; payload: Partial<UserScripts> };

export type SET_PLAYBACK_CONFIG = { type: "SET_PLAYBACK_CONFIG"; payload: Partial<PlaybackConfig> };

export type ClosePanelPayload = {
  tabId?: string;
  root: MosaicNode<string>;
  path: MosaicPath;
};
export type CLOSE_PANEL = { type: "CLOSE_PANEL"; payload: ClosePanelPayload };

export type SplitPanelPayload = {
  tabId?: string;
  id: string;
  direction: "row" | "column";
  root: MosaicNode<string>;
  path: MosaicPath;
  config: PanelConfig;
};
export type SPLIT_PANEL = { type: "SPLIT_PANEL"; payload: SplitPanelPayload };

export type SwapPanelPayload = {
  tabId?: string;
  originalId: string;
  type: string;
  root: MosaicNode<string>;
  path: MosaicPath;
  config: PanelConfig;
};
export type SWAP_PANEL = { type: "SWAP_PANEL"; payload: SwapPanelPayload };

export type MoveTabPayload = { source: TabLocation; target: TabLocation };
export type MOVE_TAB = { type: "MOVE_TAB"; payload: MoveTabPayload };

export type AddPanelPayload = {
  /** id must be formatted as returned by `getPanelIdForType`. This is required as an argument
   * rather than automatically generated because the caller may want to use the new id for
   * something, such as selecting the newly added panel. */
  id: string;
  tabId?: string;
  config?: PanelConfig;
};
export type ADD_PANEL = { type: "ADD_PANEL"; payload: AddPanelPayload };

export type DropPanelPayload = {
  newPanelType: string;
  destinationPath?: MosaicPath;
  position?: "top" | "bottom" | "left" | "right";
  tabId?: string;
  config?: PanelConfig;
};
export type DROP_PANEL = { type: "DROP_PANEL"; payload: DropPanelPayload };

export type StartDragPayload = {
  path: MosaicPath;
  sourceTabId?: string;
};
export type START_DRAG = { type: "START_DRAG"; payload: StartDragPayload };

export type EndDragPayload = {
  originalLayout: MosaicNode<string>;
  originalSavedProps: SavedProps;
  panelId: string;
  sourceTabId?: string;
  targetTabId?: string;
  position?: MosaicDropTargetPosition;
  destinationPath?: MosaicPath;
  ownPath: MosaicPath;
};
export type END_DRAG = { type: "END_DRAG"; payload: EndDragPayload };

export type PanelsActions =
  | CHANGE_PANEL_LAYOUT
  | SAVE_PANEL_CONFIGS
  | SAVE_FULL_PANEL_CONFIG
  | CREATE_TAB_PANEL
  | OVERWRITE_GLOBAL_DATA
  | SET_GLOBAL_DATA
  | SET_STUDIO_NODES
  | SET_PLAYBACK_CONFIG
  | CLOSE_PANEL
  | SPLIT_PANEL
  | SWAP_PANEL
  | MOVE_TAB
  | ADD_PANEL
  | DROP_PANEL
  | START_DRAG
  | END_DRAG;
