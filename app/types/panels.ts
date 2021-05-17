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
import type { MosaicNode, MosaicPath } from "react-mosaic-component";

import { PanelsState } from "@foxglove/studio-base/reducers/panels";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

// Mosaic Types
export type MosaicDropTargetPosition = "top" | "bottom" | "left" | "right";
export type MosaicDropResult = {
  path?: MosaicPath;
  position?: MosaicDropTargetPosition;
  tabId?: string;
};

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

export type ConfigsPayload = {
  id: string;
  // if you set override to true, existing config will be completely overriden by new passed in config
  override?: boolean;
  config: PanelConfig;
  defaultConfig?: PanelConfig;
};
export type ChangePanelLayoutPayload = {
  layout?: MosaicNode<string>;
  trimSavedProps?: boolean;
};
export type SaveConfigsPayload = {
  configs: ConfigsPayload[];
};

export type SaveFullConfigPayload = {
  panelType: string;
  perPanelFunc: PerPanelFunc<any>;
};

export type SavedProps = {
  [panelId: string]: PanelConfig;
};

export type CreateTabPanelPayload = {
  idToReplace?: string;
  layout: MosaicNode<string>;
  idsToRemove: string[];
  singleTab: boolean;
};

export type ImportPanelLayoutPayload = Partial<Omit<PanelsState, "id" | "name">> & {
  skipSettingLocalStorage?: boolean;
};

export type SaveConfig<Config> = (arg0: Partial<Config>) => void;

export type UpdatePanelConfig<Config> = (
  panelType: string,
  perPanelFunc: PerPanelFunc<Config>,
) => void;

export type OpenSiblingPanel = (arg0: string, cb: (arg0: PanelConfig) => PanelConfig) => void;

type KeyPathsOfImpl<T, Prefix extends string> =
  // return never when given any/unknown
  unknown extends T
    ? never
    : // only extract keys from object types - not things like String.indexOf and Number.toString
    T extends Record<string, unknown>
    ? {
        [K in keyof T]-?: K extends string
          ? `${Prefix}${K}` | KeyPathsOfImpl<T[K], `${Prefix}${K}.`>
          : never;
      }[keyof T]
    : never;

/**
 * Get all possible key paths in an object type, for instance:
 *
 * `KeyPathsOf<{a: 1, b?: {c: 2}}> = "a" | "b" | "b.c"`
 */
type KeyPathsOf<T> = KeyPathsOfImpl<T, "">;

export type PanelConfigSchemaEntry<ConfigKey> =
  | { key: ConfigKey; type: "text"; title: string; placeholder?: string }
  | {
      key: ConfigKey;
      type: "number";
      title: string;
      /**
       * If validate returns undefined, the field value will not be changed. Otherwise the returned
       * value will be used instead of the input value.
       */
      validate?: (value: number) => number | undefined;
      placeholder?: string;
      allowEmpty?: boolean;
    }
  | { key: ConfigKey; type: "color"; title: string }
  | { key: ConfigKey; type: "toggle"; title: string }
  | {
      key: ConfigKey;
      type: "dropdown";
      title: string;
      options: { value: string | number; text: string }[];
    };
export type PanelConfigSchema<Config> = unknown extends Config
  ? PanelConfigSchemaEntry<string>[]
  : PanelConfigSchemaEntry<KeyPathsOf<Config>>[];
