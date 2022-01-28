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

import styled from "styled-components";

import { filterMap } from "@foxglove/den/collection";
import { Color } from "@foxglove/regl-worldview";
import { LinkedGlobalVariable } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { canEditNamespaceOverrideColorDatatype } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/index";
import { TOPIC_DISPLAY_MODES } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import naturalSort from "@foxglove/studio-base/util/naturalSort";

import TooltipRow from "./TooltipRow";
import TooltipTable from "./TooltipTable";
import TreeNodeRow from "./TreeNodeRow";
import renderNamespaceNodes, { NamespaceNode } from "./renderNamespaceNodes";
import { renderStyleExpressionNodes } from "./renderStyleExpressionNodes";
import {
  DerivedCustomSettingsByKey,
  GetIsNamespaceCheckedByDefault,
  GetIsTreeNodeVisibleInScene,
  GetIsTreeNodeVisibleInTree,
  NamespacesByTopic,
  OnNamespaceOverrideColorChange,
  SceneErrorsByKey,
  SetCurrentEditingTopic,
  TopicDisplayMode,
  TreeNode,
  TreeTopicNode,
  TreeUINode,
  VisibleTopicsCountByKey,
} from "./types";
import { generateNodeKey } from "./useTopicTree";

export const SWITCHER_WIDTH = 24;

const TooltipDescription = styled(TooltipRow)`
  line-height: 1.3;
  max-width: 300px;
`;

type Props = {
  availableNamespacesByTopic: NamespacesByTopic;
  checkedKeysSet: Set<string>;
  children: TreeNode[];
  derivedCustomSettingsByKey: DerivedCustomSettingsByKey;
  filterText: string;
  getIsNamespaceCheckedByDefault: GetIsNamespaceCheckedByDefault;
  getIsTreeNodeVisibleInScene: GetIsTreeNodeVisibleInScene;
  getIsTreeNodeVisibleInTree: GetIsTreeNodeVisibleInTree;
  isXSWidth: boolean;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
  sceneErrorsByKey: SceneErrorsByKey;
  setCurrentEditingTopic: SetCurrentEditingTopic;
  topicDisplayMode: TopicDisplayMode;
  visibleTopicsCountByKey: VisibleTopicsCountByKey;
  width: number;
  linkedGlobalVariablesByTopic: {
    [key: string]: LinkedGlobalVariable[];
  };
};

export function getNamespaceNodes({
  availableNamespacesByTopic,
  canEditNamespaceOverrideColor,
  checkedKeysSet,
  derivedCustomSettingsByKey,
  getIsNamespaceCheckedByDefault,
  getIsTreeNodeVisibleInScene,
  node,
  showVisible,
}: {
  availableNamespacesByTopic: NamespacesByTopic;
  canEditNamespaceOverrideColor: boolean;
  checkedKeysSet: Set<string>;
  derivedCustomSettingsByKey: DerivedCustomSettingsByKey;
  getIsNamespaceCheckedByDefault: GetIsNamespaceCheckedByDefault;
  getIsTreeNodeVisibleInScene: GetIsTreeNodeVisibleInScene;
  node: TreeTopicNode;
  showVisible: boolean;
}): NamespaceNode[] {
  const topicName = node.topicName;
  const baseNamespacesSet = new Set(
    (topicName.length !== 0 && availableNamespacesByTopic[topicName]) || [],
  );
  return filterMap(Array.from(baseNamespacesSet), (namespace) => {
    const namespaceKey = generateNodeKey({ topicName, namespace });
    const topicNodeKey = node.key;
    let overrideColor: Color | undefined = undefined;
    let hasNamespaceOverrideColorChanged: boolean = false;

    if (canEditNamespaceOverrideColor) {
      // Use namespace overrideColor by default, and fall back to topic overrideColor.
      const namespaceOverrideColor = derivedCustomSettingsByKey[namespaceKey]?.overrideColor;
      const topicOverrideColor = derivedCustomSettingsByKey[topicNodeKey]?.overrideColor;
      overrideColor = namespaceOverrideColor ?? topicOverrideColor;
      // The namespace color has changed if there is an override color.
      hasNamespaceOverrideColorChanged = !!namespaceOverrideColor;
    }
    const namespaceNode = {
      key: namespaceKey,
      namespace,
      overrideColor,
      hasNamespaceOverrideColorChanged,
      available: baseNamespacesSet.has(namespace),
      checked: checkedKeysSet.has(namespaceKey) || getIsNamespaceCheckedByDefault(topicName),
      visibleInScene: getIsTreeNodeVisibleInScene(node, namespace),
    };

    const visible = namespaceNode.visibleInScene;
    // Don't render namespaces that are not visible when the user selected to view Visible only.
    if (node.providerAvailable && showVisible && !visible) {
      return undefined;
    }
    return namespaceNode;
  });
}

// A recursive function for generating tree nodes UI. Must use function instead of React component as the
// return signature is different from React component.
export default function renderTreeNodes({
  availableNamespacesByTopic,
  checkedKeysSet,
  children,
  derivedCustomSettingsByKey,
  filterText,
  getIsNamespaceCheckedByDefault,
  getIsTreeNodeVisibleInScene,
  getIsTreeNodeVisibleInTree,
  isXSWidth,
  onNamespaceOverrideColorChange,
  sceneErrorsByKey,
  setCurrentEditingTopic,
  topicDisplayMode,
  visibleTopicsCountByKey,
  width,
  linkedGlobalVariablesByTopic,
}: Props): TreeUINode[] {
  const titleWidth = width - SWITCHER_WIDTH;

  return filterMap(children, (item) => {
    const { key, providerAvailable } = item;
    if (!getIsTreeNodeVisibleInTree(key)) {
      return undefined;
    }
    const visible = getIsTreeNodeVisibleInScene(item);

    const nodeVisibleInScene = visible;
    const nodeAvailable = item.available;

    const showVisible = topicDisplayMode === TOPIC_DISPLAY_MODES.SHOW_SELECTED.value;
    const showAvailable = topicDisplayMode === TOPIC_DISPLAY_MODES.SHOW_AVAILABLE.value;

    // Render all nodes regardless of the displayMode when datasources are unavailable.
    if (
      providerAvailable &&
      ((showVisible && !nodeVisibleInScene) || (showAvailable && !nodeAvailable))
    ) {
      return undefined;
    }

    const itemChildren = item.type === "group" ? item.children : [];
    const topicName = item.type === "topic" ? item.topicName : "";
    const datatype = item.type === "topic" ? item.datatype : undefined;

    const namespaceNodes =
      item.type === "topic"
        ? getNamespaceNodes({
            availableNamespacesByTopic,
            canEditNamespaceOverrideColor: !!(
              datatype && canEditNamespaceOverrideColorDatatype(datatype)
            ),
            checkedKeysSet,
            derivedCustomSettingsByKey,
            getIsNamespaceCheckedByDefault,
            getIsTreeNodeVisibleInScene,
            node: item,
            showVisible,
          })
        : [];

    const tooltips = [];
    if (topicName.length !== 0) {
      tooltips.push(
        <TooltipRow key={tooltips.length}>
          <TooltipTable>
            <tbody>
              <tr>
                <th>Topic:</th>
                <td>
                  <code>{topicName}</code>
                </td>
              </tr>
              {item.type === "topic" && item.datatype && (
                <tr>
                  <th>Type:</th>
                  <td>
                    <code>{item.datatype}</code>
                  </td>
                </tr>
              )}
            </tbody>
          </TooltipTable>
        </TooltipRow>,
      );
    }
    if (item.description != undefined) {
      tooltips.push(
        <TooltipDescription key={tooltips.length}>{item.description}</TooltipDescription>,
      );
    }

    const title = (
      <TreeNodeRow
        checkedKeysSet={checkedKeysSet}
        derivedCustomSettings={derivedCustomSettingsByKey[key]}
        filterText={filterText}
        hasChildren={itemChildren.length > 0 || namespaceNodes.length > 0}
        isXSWidth={isXSWidth}
        node={item}
        nodeVisibleInScene={nodeVisibleInScene}
        sceneErrors={sceneErrorsByKey[item.key]}
        setCurrentEditingTopic={setCurrentEditingTopic}
        visible={visible}
        width={titleWidth}
        visibleTopicsCount={visibleTopicsCountByKey[item.key] ?? 0}
        {...(tooltips.length > 0 ? { tooltips } : undefined)}
      />
    );

    const childrenNodes = [];
    if (item.type === "topic") {
      childrenNodes.push(
        ...renderStyleExpressionNodes({
          isXSWidth,
          topicName,
          linkedGlobalVariablesByTopic,
          width: titleWidth,
        }),
      );

      childrenNodes.push(
        ...renderNamespaceNodes({
          children: namespaceNodes.sort(naturalSort("namespace")),
          getIsTreeNodeVisibleInTree,
          isXSWidth,
          onNamespaceOverrideColorChange,
          topicNode: item,
          width: titleWidth,
          filterText,
        }),
      );
    }
    childrenNodes.push(
      ...renderTreeNodes({
        availableNamespacesByTopic,
        checkedKeysSet,
        children: itemChildren,
        getIsTreeNodeVisibleInScene,
        getIsTreeNodeVisibleInTree,
        getIsNamespaceCheckedByDefault,
        isXSWidth,
        onNamespaceOverrideColorChange,
        topicDisplayMode,
        sceneErrorsByKey,
        setCurrentEditingTopic,
        derivedCustomSettingsByKey,
        visibleTopicsCountByKey,
        width: titleWidth,
        filterText,
        linkedGlobalVariablesByTopic,
      }),
    );
    return {
      key,
      title,
      ...(childrenNodes.length > 0 ? { children: childrenNodes } : undefined),
      // Add `disabled` so that the switcher has the correct color.
      disabled: !nodeVisibleInScene,
    };
  });
}
