// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IconButtonProps, TooltipProps } from "@mui/material";
import { CSSProperties, ReactNode } from "react";

import { Immutable, Topic } from "@lichtblick/suite";
import { MessageEvent } from "@lichtblick/suite-base/players/types";
import { OpenSiblingPanel, SaveConfig } from "@lichtblick/suite-base/types/panels";

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type RawMessagesPanelConfig = {
  diffEnabled: boolean;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  expansion?: NodeExpansion;
  showFullMessageForDiff: boolean;
  topicPath: string;
  fontSize: number | undefined;
};

export type RawMessagesTwoPanelConfig = {
  diffEnabled: boolean;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  expansion?: NodeExpansion;
  showFullMessageForDiff: boolean;
  topicPath: string;
  fontSize: number | undefined;
};

// Terse to save space in layout. c = collapsed, e = expanded.
export enum NodeState {
  Collapsed = "c",
  Expanded = "e",
}

export type NodeExpansion = "all" | "none" | Record<string, NodeState>;

export type DiffObject = Record<string, unknown>;

export type TreeNode = {
  key: string;
  label: string;
  value: unknown;
  depth: number;
  isExpandable: boolean;
  keyPath: (string | number)[];
  parentPath: string;
};

export type ValueAction = {
  singleSlicePath: string;
  multiSlicePath: string;
  primitiveType: string;
  filterPath: string;
};

// Props

export type PropsDiffSpan = {
  children?: ReactNode;
  style?: CSSProperties;
};

export type PropsDiffStats = {
  data: DiffObject;
  itemType: ReactNode;
};

export type PropsHighlightedValue = {
  itemLabel: string;
};

export type PropsRawMessages = {
  config: Immutable<RawMessagesPanelConfig>;
  saveConfig: SaveConfig<RawMessagesPanelConfig>;
};

export type PropsRawMessagesTwo = {
  config: Immutable<RawMessagesTwoPanelConfig>;
  saveConfig: SaveConfig<RawMessagesTwoPanelConfig>;
};

export type PropsMaybeCollapsedValue = { itemLabel: string };

export type PropsMetadata = {
  data: unknown;
  diffData: unknown;
  diff: unknown;
  datatype?: string;
  message: MessageEvent;
  diffMessage?: MessageEvent;
};

export type PropsToolbar = {
  canExpandAll: boolean;
  diffEnabled: boolean;
  diffMethod: RawMessagesTwoPanelConfig["diffMethod"];
  diffTopicPath: string;
  onDiffTopicPathChange: (path: string) => void;
  onToggleDiff: () => void;
  onToggleExpandAll: () => void;
  onTopicPathChange: (path: string) => void;
  saveConfig: SaveConfig<RawMessagesTwoPanelConfig>;
  topic?: Topic;
  topicPath: string;
};

export type PropsValue = {
  arrLabel: string;
  basePath: string;
  itemLabel: string;
  itemValue: unknown;
  valueAction: ValueAction | undefined;
  onTopicPathChange: (arg0: string) => void;
  openSiblingPanel: OpenSiblingPanel;
};

export type ValueActionItem = {
  key: string;
  tooltip: TooltipProps["title"];
  icon: React.ReactNode;
  onClick?: IconButtonProps["onClick"];
  activeColor?: IconButtonProps["color"];
  color?: IconButtonProps["color"];
};

export type PropsVirtualizedTree = {
  data: unknown;
  expandedNodes: Set<string>;
  onToggleExpand: (keyPath: string) => void;
  fontSize?: number;
  renderValue?: (node: TreeNode) => React.ReactNode;
};
