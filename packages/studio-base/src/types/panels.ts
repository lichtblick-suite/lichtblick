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

import type { MosaicPath } from "react-mosaic-component";

// Mosaic Types
export type MosaicDropTargetPosition = "top" | "bottom" | "left" | "right";
export type MosaicDropResult = {
  path?: MosaicPath;
  position?: MosaicDropTargetPosition;
  tabId?: string;
};

export type PanelConfig = {
  [key: string]: unknown;
};

export type TimeDisplayMethod = "SEC" | "TOD";

export type PlaybackConfig = {
  speed: number;
};

export type UserNode = { name: string; sourceCode: string };
export type UserNodes = {
  [nodeId: string]: UserNode;
};

export type SaveConfig<Config> = (
  newConfig: Partial<Config> | ((oldConfig: Config) => Partial<Config>),
) => void;

export type SavedProps = {
  [panelId: string]: PanelConfig;
};

export type OpenSiblingPanel = (params: {
  panelType: string;
  siblingConfigCreator: (config: PanelConfig) => PanelConfig;
  updateIfExists: boolean;
}) => void;
