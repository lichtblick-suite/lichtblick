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

import { useCallback, useContext, useMemo } from "react";

import { Color } from "@foxglove/regl-worldview";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ThreeDimensionalVizContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import { TREE_SPACING } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import { TopicTreeContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/useTopicTree";
import { TRANSFORM_TOPIC } from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";
import { joinTopics } from "@foxglove/studio-base/util/topicUtils";

import NamespaceMenu from "./NamespaceMenu";
import NodeName from "./NodeName";
import TooltipRow from "./TooltipRow";
import TooltipTable from "./TooltipTable";
import { SToggles, STreeNodeRow, SLeft, SRightActions, ICON_SIZE } from "./TreeNodeRow";
import VisibilityToggle, { TOGGLE_WRAPPER_SIZE } from "./VisibilityToggle";
import {
  GetIsTreeNodeVisibleInTree,
  OnNamespaceOverrideColorChange,
  TreeTopicNode,
  TreeUINode,
} from "./types";

const OUTER_LEFT_MARGIN = 12;
const INNER_LEFT_MARGIN = 8;

export type NamespaceNode = {
  availableByColumn: boolean[];
  checkedByColumn: boolean[];
  featureKey: string;
  hasNamespaceOverrideColorChangedByColumn: boolean[];
  key: string;
  namespace: string;
  overrideColorByColumn?: (Color | undefined)[];
  visibleInSceneByColumn: boolean[];
};

type Props = {
  children: NamespaceNode[];
  filterText: string;
  getIsTreeNodeVisibleInTree: GetIsTreeNodeVisibleInTree;
  hasFeatureColumn: boolean;
  isXSWidth: boolean;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
  topicNode: TreeTopicNode;
  width: number;
  diffModeEnabled: boolean;
};

function NamespaceNodeRow({
  nodeKey,
  hasNamespaceOverrideColorChangedByColumn,
  namespace,
  checkedByColumn,
  availableByColumn,
  overrideColorByColumn,
  visibleInSceneByColumn,
  rowWidth,
  isXSWidth,
  maxNodeNameLen,
  filterText,
  topicNodeAvailable,
  unavailableTooltip,
  hasFeatureColumn,
  topicName,
  onNamespaceOverrideColorChange,
  diffModeEnabled,
}: {
  nodeKey: string;
  featureKey: string;
  hasNamespaceOverrideColorChangedByColumn: boolean[];
  namespace: string;
  availableByColumn: boolean[];
  checkedByColumn: boolean[];
  overrideColorByColumn?: (Color | undefined)[];
  visibleInSceneByColumn: boolean[];
  rowWidth: number;
  isXSWidth: boolean;
  maxNodeNameLen: number;
  filterText: string;
  topicNodeAvailable: boolean;
  unavailableTooltip: string;
  hasFeatureColumn: boolean;
  topicName: string;
  diffModeEnabled: boolean;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
}) {
  const nodeVisibleInScene =
    (visibleInSceneByColumn[0] ?? false) || (visibleInSceneByColumn[1] ?? false);

  const { setHoveredMarkerMatchers } = useContext(ThreeDimensionalVizContext);
  const { toggleCheckAllAncestors, toggleNamespaceChecked } = useGuaranteedContext(
    TopicTreeContext,
    "TopicTreeContext",
  );

  const updateHoveredMarkerMatchers = useCallback(
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    (columnIndex: number, visible: boolean) => {
      if (visible) {
        const topic = [topicName, joinTopics(SECOND_SOURCE_PREFIX, topicName)][columnIndex];
        if (!topic) {
          return;
        }
        setHoveredMarkerMatchers([
          { topic, checks: [{ markerKeyPath: ["ns"], value: namespace }] },
        ]);
      }
    },
    [namespace, setHoveredMarkerMatchers, topicName],
  );

  const onMouseLeave = useCallback(() => setHoveredMarkerMatchers([]), [setHoveredMarkerMatchers]);
  const mouseEventHandlersByColumnIdx = useMemo(() => {
    return new Array(2).fill(0).map((_topic, columnIndex) => ({
      onMouseEnter: () => updateHoveredMarkerMatchers(columnIndex, true),
      onMouseLeave,
    }));
  }, [updateHoveredMarkerMatchers, onMouseLeave]);

  const onToggle = useCallback(
    (columnIndex: number) => {
      toggleNamespaceChecked({ topicName, namespace, columnIndex });
      updateHoveredMarkerMatchers(columnIndex, !(visibleInSceneByColumn[columnIndex] ?? false));
    },
    [
      toggleNamespaceChecked,
      topicName,
      namespace,
      updateHoveredMarkerMatchers,
      visibleInSceneByColumn,
    ],
  );
  const onAltToggle = useCallback(
    (columnIndex: number) => {
      toggleCheckAllAncestors(nodeKey, columnIndex, topicName);
      updateHoveredMarkerMatchers(columnIndex, !(visibleInSceneByColumn[columnIndex] ?? false));
    },
    [
      toggleCheckAllAncestors,
      nodeKey,
      topicName,
      updateHoveredMarkerMatchers,
      visibleInSceneByColumn,
    ],
  );

  return (
    <STreeNodeRow
      visibleInScene={nodeVisibleInScene}
      style={{
        width: rowWidth,
        marginLeft: `-${OUTER_LEFT_MARGIN}px`,
      }}
    >
      <SLeft data-test={`ns~${namespace}`}>
        <NodeName
          isXSWidth={isXSWidth}
          maxWidth={maxNodeNameLen}
          displayName={namespace}
          topicName={""}
          tooltips={[
            <TooltipRow key={namespace}>
              <TooltipTable>
                <tbody>
                  <tr>
                    <th>Namespace:</th>
                    <td>
                      <code>{namespace}</code>
                    </td>
                  </tr>
                </tbody>
              </TooltipTable>
            </TooltipRow>,
          ]}
          searchText={filterText}
        />
      </SLeft>
      <SRightActions>
        <SToggles>
          {availableByColumn.map((available, columnIndex) => (
            <VisibilityToggle // Some namespaces are statically available. But we want to make sure the parent topic is also available
              // before showing it as available.
              available={topicNodeAvailable && available}
              checked={checkedByColumn[columnIndex] ?? false}
              dataTest={`visibility-toggle~${nodeKey}~column${columnIndex}`}
              key={columnIndex}
              onAltToggle={() => onAltToggle(columnIndex)}
              onToggle={() => onToggle(columnIndex)}
              overrideColor={overrideColorByColumn?.[columnIndex]}
              size="SMALL"
              unavailableTooltip={unavailableTooltip}
              visibleInScene={visibleInSceneByColumn[columnIndex] ?? false}
              {...mouseEventHandlersByColumnIdx[columnIndex]}
              diffModeEnabled={diffModeEnabled}
              columnIndex={columnIndex}
            />
          ))}
        </SToggles>
        <NamespaceMenu
          disableBaseColumn={!(availableByColumn[0] ?? false)}
          disableFeatureColumn={!(availableByColumn[1] ?? false)}
          hasFeatureColumn={hasFeatureColumn && (availableByColumn[1] ?? false)}
          hasNamespaceOverrideColorChangedByColumn={hasNamespaceOverrideColorChangedByColumn}
          namespace={namespace}
          nodeKey={nodeKey}
          onNamespaceOverrideColorChange={onNamespaceOverrideColorChange}
          overrideColorByColumn={overrideColorByColumn}
          providerAvailable={topicNodeAvailable}
          topicName={topicName}
        />
      </SRightActions>
    </STreeNodeRow>
  );
}

// Must use function instead of React component as Tree/TreeNode can only accept TreeNode as children.
export default function renderNamespaceNodes({
  children,
  filterText,
  getIsTreeNodeVisibleInTree,
  hasFeatureColumn,
  isXSWidth,
  onNamespaceOverrideColorChange,
  topicNode,
  width,
  diffModeEnabled,
}: Props): TreeUINode[] {
  const rowWidth = width - (isXSWidth ? 0 : TREE_SPACING * 2) - OUTER_LEFT_MARGIN;
  const topicNodeAvailable = topicNode.availableByColumn.some((value) => value);
  const togglesWidth = hasFeatureColumn ? TOGGLE_WRAPPER_SIZE * 2 : TOGGLE_WRAPPER_SIZE;
  const rightActionWidth = topicNodeAvailable ? togglesWidth + ICON_SIZE : ICON_SIZE;
  const maxNodeNameLen = rowWidth - rightActionWidth - INNER_LEFT_MARGIN * 2;

  // TODO(Audrey): remove the special tooltip once we add 2nd bag support for map and tf namespaces.
  const unavailableTooltip =
    topicNode.topicName === TRANSFORM_TOPIC || topicNode.topicName === "/metadata"
      ? "Unsupported"
      : "Unavailable";

  const commonRowProps = {
    rowWidth,
    isXSWidth,
    maxNodeNameLen,
    filterText,
    topicNodeAvailable,
    onNamespaceOverrideColorChange,
    unavailableTooltip,
    hasFeatureColumn,
    topicName: topicNode.topicName,
    diffModeEnabled,
  };

  return children
    .filter(({ key }) => getIsTreeNodeVisibleInTree(key))
    .map(
      ({
        key,
        featureKey,
        hasNamespaceOverrideColorChangedByColumn,
        namespace,
        checkedByColumn,
        availableByColumn,
        overrideColorByColumn,
        visibleInSceneByColumn,
      }) => {
        const title = (
          <NamespaceNodeRow
            {...{
              featureKey,
              hasNamespaceOverrideColorChangedByColumn,
              namespace,
              checkedByColumn,
              availableByColumn,
              overrideColorByColumn,
              visibleInSceneByColumn,
              nodeKey: key,
              ...commonRowProps,
            }}
          />
        );
        return { key, title };
      },
    );
}
