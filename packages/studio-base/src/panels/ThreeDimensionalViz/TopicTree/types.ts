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

import { Color } from "@foxglove/regl-worldview";
import { TOPIC_DISPLAY_MODES } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import { Topic } from "@foxglove/studio-base/players/types";
import { Namespace } from "@foxglove/studio-base/types/Messages";

import { Save3DConfig } from "../index";

export type TopicDisplayMode = keyof typeof TOPIC_DISPLAY_MODES;
export type TopicTreeConfig = {
  name?: string;
  // displayName is only used to maintain TopicGroups flow type.
  displayName?: string;
  topicName?: string;
  children?: TopicTreeConfig[];
  description?: string;
};

export type TreeUINode = {
  title: React.ReactNode;
  key: string;
  children?: TreeUINode[];
  disabled?: boolean;
};

export type NamespacesByTopic = {
  [topicName: string]: string[];
};

export type TreeGroupNode = {
  type: "group";
  name: string;
  key: string;
  featureKey: string;
  parentKey?: string;
  availableByColumn: boolean[];
  // Whether the data providers are available. If it is and the current node is not available, we'll show
  // the node name being striked through in the UI.
  providerAvailable: boolean;
  children: TreeNode[];
  description?: undefined;
};
export type TreeTopicNode = {
  type: "topic";
  topicName: string;
  key: string;
  featureKey: string;
  parentKey?: string;
  name?: string;
  datatype?: string;
  description?: string;
  providerAvailable: boolean;
  availableByColumn: boolean[];
  children?: undefined;
};

export type TreeNode = TreeGroupNode | TreeTopicNode;

export type UseSceneBuilderAndTransformsDataInput = {
  sceneBuilder: {
    allNamespaces: Namespace[];
    errorsByTopic: { [topicName: string]: string[] };
  };
  staticallyAvailableNamespacesByTopic: NamespacesByTopic;
  transforms: {
    values(): { id: string }[];
  };
};

export type SceneErrorsByKey = {
  [topicName: string]: string[];
};

export type UseSceneBuilderAndTransformsDataOutput = {
  availableNamespacesByTopic: NamespacesByTopic;
  sceneErrorsByKey: SceneErrorsByKey;
};

export type UseTreeInput = {
  availableNamespacesByTopic: NamespacesByTopic;
  checkedKeys: string[];
  defaultTopicSettings: {
    [topicName: string]: Record<string, unknown>;
  };
  expandedKeys: string[];
  filterText: string;
  modifiedNamespaceTopics: string[];
  providerTopics: Topic[]; // Only changes when e.g. dragging in a new bag.
  saveConfig: Save3DConfig;
  sceneErrorsByTopicKey: SceneErrorsByKey;
  topicDisplayMode: TopicDisplayMode;
  settingsByKey: {
    [topicOrNamespaceKey: string]: Record<string, unknown>;
  };
  topicTreeConfig: TopicTreeConfig; // Never changes!
  uncategorizedGroupName: string;
};

export type GetIsTreeNodeVisibleInScene = (
  topicNode: TreeNode,
  columnIndex: number,
  namespaceKey?: string,
) => boolean;
export type GetIsTreeNodeVisibleInTree = (key: string) => boolean;
export type SetCurrentEditingTopic = (arg0?: Topic) => void;
export type ToggleNode = (nodeKey: string, namespaceParentTopicName?: string) => void;
export type ToggleNodeByColumn = (
  nodeKey: string,
  columnIndex: number,
  namespaceParentTopicName?: string,
) => void;
export type ToggleNamespaceChecked = (arg0: {
  topicName: string;
  namespace: string;
  columnIndex: number;
}) => void;
export type GetIsNamespaceCheckedByDefault = (topicName: string, columnIndex: number) => boolean;
export type DerivedCustomSettings = {
  overrideColorByColumn?: (Color | undefined)[];
  isDefaultSettings?: boolean;
};
export type DerivedCustomSettingsByKey = {
  [key: string]: DerivedCustomSettings;
};
export type OnNamespaceOverrideColorChange = (
  newRbgaColor: Color | undefined,
  prefixedNamespaceKey: string,
) => void;
export type VisibleTopicsCountByKey = {
  [nodeKey: string]: number;
};
export type UseTreeOutput = {
  // Instead of precomputing visible states for all nodes, pass the function down to the nodes
  // so that only rendered nodes' visibility is computed since we support virtualization in the tree.
  getIsTreeNodeVisibleInScene: GetIsTreeNodeVisibleInScene;
  getIsTreeNodeVisibleInTree: GetIsTreeNodeVisibleInTree;
  getIsNamespaceCheckedByDefault: GetIsNamespaceCheckedByDefault;
  hasFeatureColumn: boolean;
  // For testing.
  nodesByKey: {
    [key: string]: TreeNode;
  };
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
  toggleCheckAllAncestors: ToggleNodeByColumn;
  toggleCheckAllDescendants: ToggleNodeByColumn;
  toggleNamespaceChecked: ToggleNamespaceChecked;
  toggleNodeChecked: ToggleNodeByColumn;
  toggleNodeExpanded: ToggleNode;
  rootTreeNode: TreeNode;
  selectedNamespacesByTopic: {
    [topicName: string]: string[];
  };
  selectedTopicNames: string[];
  derivedCustomSettingsByKey: DerivedCustomSettingsByKey;
  sceneErrorsByKey: SceneErrorsByKey;
  allKeys: string[];
  shouldExpandAllKeys: boolean;
  visibleTopicsCountByKey: VisibleTopicsCountByKey;
};
