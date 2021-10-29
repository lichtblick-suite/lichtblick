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

import { uniq } from "lodash";
import styled from "styled-components";

import { filterMap } from "@foxglove/den/collection";
import { Color } from "@foxglove/regl-worldview";
import { LinkedGlobalVariable } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { canEditNamespaceOverrideColorDatatype } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/index";
import { TOPIC_DISPLAY_MODES } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";
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
  hasFeatureColumn: boolean;
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
  diffModeEnabled: boolean;
};

export function getNamespaceNodes({
  availableNamespacesByTopic,
  canEditNamespaceOverrideColor,
  checkedKeysSet,
  derivedCustomSettingsByKey,
  getIsNamespaceCheckedByDefault,
  getIsTreeNodeVisibleInScene,
  hasFeatureColumn,
  node,
  showVisible,
}: {
  availableNamespacesByTopic: NamespacesByTopic;
  canEditNamespaceOverrideColor: boolean;
  checkedKeysSet: Set<string>;
  derivedCustomSettingsByKey: DerivedCustomSettingsByKey;
  getIsNamespaceCheckedByDefault: GetIsNamespaceCheckedByDefault;
  getIsTreeNodeVisibleInScene: GetIsTreeNodeVisibleInScene;
  hasFeatureColumn: boolean;
  node: TreeTopicNode;
  showVisible: boolean;
}): NamespaceNode[] {
  const topicName = node.topicName;
  const baseNamespacesSet = new Set(
    (topicName.length !== 0 && availableNamespacesByTopic[topicName]) || [],
  );
  const featureNamespacesSet = new Set(
    (topicName.length !== 0 &&
      hasFeatureColumn &&
      availableNamespacesByTopic[`${SECOND_SOURCE_PREFIX}${topicName}`]) ||
      [],
  );
  const uniqueNamespaces = uniq([
    ...Array.from(baseNamespacesSet),
    ...Array.from(featureNamespacesSet),
  ]);
  const columns = hasFeatureColumn ? [0, 1] : [0];
  return filterMap(uniqueNamespaces, (namespace) => {
    const namespaceKey = generateNodeKey({ topicName, namespace });
    const featureKey = generateNodeKey({ topicName, namespace, isFeatureColumn: true });
    const topicNodeKey = node.key;
    const overrideColorByColumn: (Color | undefined)[] = [];
    const hasNamespaceOverrideColorChangedByColumn: boolean[] = [];

    if (canEditNamespaceOverrideColor) {
      // Use namespace overrideColor by default, and fall back to topic overrideColor.
      const namespaceOverrideColorByColumn =
        derivedCustomSettingsByKey[namespaceKey]?.overrideColorByColumn ?? [];
      const topicOverrideColorByColumn =
        derivedCustomSettingsByKey[topicNodeKey]?.overrideColorByColumn ?? [];
      columns.forEach((columnIdx) => {
        overrideColorByColumn.push(
          namespaceOverrideColorByColumn[columnIdx] ?? topicOverrideColorByColumn[columnIdx],
        );
        // The namespace color has changed if there is an override color.
        hasNamespaceOverrideColorChangedByColumn.push(!!namespaceOverrideColorByColumn[columnIdx]);
      });
    }
    const namespaceNode = {
      key: namespaceKey,
      featureKey,
      namespace,
      overrideColorByColumn,
      hasNamespaceOverrideColorChangedByColumn,
      availableByColumn: columns.map((columnIdx) =>
        columnIdx === 1 ? featureNamespacesSet.has(namespace) : baseNamespacesSet.has(namespace),
      ),
      checkedByColumn: columns.map(
        (columnIdx) =>
          checkedKeysSet.has(columnIdx === 1 ? featureKey : namespaceKey) ||
          getIsNamespaceCheckedByDefault(topicName, columnIdx),
      ),
      visibleInSceneByColumn: columns.map((columnIdx) =>
        getIsTreeNodeVisibleInScene(node, columnIdx, namespace),
      ),
    };

    const visible =
      (namespaceNode.visibleInSceneByColumn[0] ?? false) ||
      (namespaceNode.visibleInSceneByColumn[1] ?? false);
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
  hasFeatureColumn,
  isXSWidth,
  onNamespaceOverrideColorChange,
  sceneErrorsByKey,
  setCurrentEditingTopic,
  topicDisplayMode,
  visibleTopicsCountByKey,
  width,
  linkedGlobalVariablesByTopic,
  diffModeEnabled,
}: Props): TreeUINode[] {
  const titleWidth = width - SWITCHER_WIDTH;

  return filterMap(children, (item) => {
    const { key, providerAvailable } = item;
    if (!getIsTreeNodeVisibleInTree(key)) {
      return undefined;
    }
    const visibleByColumn = hasFeatureColumn
      ? [getIsTreeNodeVisibleInScene(item, 0), getIsTreeNodeVisibleInScene(item, 1)]
      : [getIsTreeNodeVisibleInScene(item, 0)];

    const nodeVisibleInScene = (visibleByColumn[0] ?? false) || (visibleByColumn[1] ?? false);
    const nodeAvailable =
      (item.availableByColumn[0] ?? false) || (item.availableByColumn[1] ?? false);

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
            hasFeatureColumn,
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
        hasFeatureColumn={hasFeatureColumn}
        isXSWidth={isXSWidth}
        node={item}
        nodeVisibleInScene={nodeVisibleInScene}
        sceneErrors={sceneErrorsByKey[item.key]}
        setCurrentEditingTopic={setCurrentEditingTopic}
        visibleByColumn={visibleByColumn}
        width={titleWidth}
        visibleTopicsCount={visibleTopicsCountByKey[item.key] ?? 0}
        {...(tooltips.length > 0 ? { tooltips } : undefined)}
        diffModeEnabled={diffModeEnabled}
      />
    );

    const childrenNodes = [];
    if (item.type === "topic") {
      childrenNodes.push(
        ...renderStyleExpressionNodes({
          isXSWidth,
          topicName,
          hasFeatureColumn,
          linkedGlobalVariablesByTopic,
          width: titleWidth,
        }),
      );

      childrenNodes.push(
        ...renderNamespaceNodes({
          children: namespaceNodes.sort(naturalSort("namespace")),
          getIsTreeNodeVisibleInTree,
          hasFeatureColumn,
          isXSWidth,
          onNamespaceOverrideColorChange,
          topicNode: item,
          width: titleWidth,
          filterText,
          diffModeEnabled,
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
        hasFeatureColumn,
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
        diffModeEnabled,
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
