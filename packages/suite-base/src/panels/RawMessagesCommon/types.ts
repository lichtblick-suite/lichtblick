// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IconButtonProps, TooltipProps } from "@mui/material";
import { CSSProperties, ReactNode } from "react";

import { MessagePath, MessagePathStructureItem } from "@lichtblick/message-path";
import { Immutable, Topic } from "@lichtblick/suite";
import { MessagePathDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import { Topic as PlayerTopic, MessageEvent } from "@lichtblick/suite-base/players/types";
import { OpenSiblingPanel, SaveConfig } from "@lichtblick/suite-base/types/panels";

export type RawMessagesPanelConfig = {
  diffEnabled: boolean;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  expansion?: NodeExpansion;
  showFullMessageForDiff: boolean;
  topicPath: string;
  fontSize: number | undefined;
};

export type RawMessagesVirtualPanelConfig = {
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

export type PropsRawMessagesVirtual = {
  config: Immutable<RawMessagesVirtualPanelConfig>;
  saveConfig: SaveConfig<RawMessagesVirtualPanelConfig>;
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
  diffMethod: RawMessagesVirtualPanelConfig["diffMethod"];
  diffTopicPath: string;
  onDiffTopicPathChange: (path: string) => void;
  onToggleDiff: () => void;
  onToggleExpandAll: () => void;
  onTopicPathChange: (path: string) => void;
  saveConfig: SaveConfig<RawMessagesVirtualPanelConfig>;
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
  renderValue: (node: TreeNode) => React.ReactNode;
};
export type ValueLabelsProps = {
  constantName: string | undefined;
  label: string;
  itemValue: unknown;
  keyPath: ReadonlyArray<number | string>;
};

export type ValueLabels = {
  arrLabel: string;
  itemLabel: string;
};

export type SharedConfig = {
  topicPath: string;
  diffMethod: "custom" | "previous message";
  diffTopicPath: string;
  diffEnabled: boolean;
  expansion?: NodeExpansion;
};

type SharedConfigActions<T extends SharedConfig> = {
  saveConfig: (config: Partial<T>) => void;
};

export type UseSharedRawMessagesLogicProps<T extends SharedConfig> = {
  config: T;
  saveConfig: SharedConfigActions<T>["saveConfig"];
};

/** getValueActionForValue */
export type PathState = {
  singleSlicePath: string;
  multiSlicePath: string;
  filterPath: string;
  value: unknown;
  structureItem: MessagePathStructureItem | undefined;
};

/** useSharedRawMessagesLogic */
export type UseSharedRawMessagesLogicResult = {
  topicRosPath: MessagePath | undefined;
  topic: PlayerTopic | undefined;
  rootStructureItem: MessagePathStructureItem | undefined;
  baseItem: ReturnType<typeof useMessageDataItem>[number] | undefined;
  diffItem: ReturnType<typeof useMessageDataItem>[number] | undefined;

  expansion: NodeExpansion | undefined;
  setExpansion: (
    expansion: NodeExpansion | ((old: NodeExpansion | undefined) => NodeExpansion),
  ) => void;
  nodes: Set<string>;
  canExpandAll: boolean;

  onTopicPathChange: (newTopicPath: string) => void;
  onDiffTopicPathChange: (newDiffTopicPath: string) => void;
  onToggleDiff: () => void;
  onToggleExpandAll: () => void;
  onLabelClick: (keypath: (string | number)[]) => void;
};

/** useRenderers */
export type UseValueRendererProps = {
  datatypes:
    | ReadonlyMap<
        string,
        {
          readonly name?: string | undefined;
          readonly definitions: readonly { readonly type: string; readonly name: string }[];
        }
      >
    | Map<
        string,
        {
          name?: string | undefined;
          definitions: readonly { readonly type: string; readonly name: string }[];
        }
      >;
  hoverObserverClassName: string;
  onTopicPathChange: (path: string) => void;
  openSiblingPanel: OpenSiblingPanel;
};

export type ValueRendererFunction = (
  structureItem: MessagePathStructureItem | undefined,
  data: unknown[],
  queriedData: MessagePathDataItem[],
  label: string,
  itemValue: unknown,
  ...keyPath: (number | string)[]
) => React.ReactNode;

export type RenderDiffLabelFunction = (label: string, itemValue: unknown) => React.ReactNode;

export const diffLabels = {
  ADDED: {
    labelText: "STUDIO_DIFF___ADDED",
    color: "#404047",
    backgroundColor: "#daffe7",
    invertedBackgroundColor: "#182924",
    indicator: "+",
  },
  DELETED: {
    labelText: "STUDIO_DIFF___DELETED",
    color: "#404047",
    backgroundColor: "#ffdee3",
    invertedBackgroundColor: "#3d2327",
    indicator: "-",
  },
  CHANGED: {
    labelText: "STUDIO_DIFF___CHANGED",
    color: "#eba800",
  },
  ID: { labelText: "STUDIO_DIFF___ID" },
} as const;
