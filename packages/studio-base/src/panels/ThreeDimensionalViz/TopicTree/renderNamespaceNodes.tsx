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

import { useCallback, useContext } from "react";

import { Color } from "@foxglove/regl-worldview";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ThreeDimensionalVizContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import { TREE_SPACING } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import { TopicTreeContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/useTopicTree";

import NamespaceMenu from "./NamespaceMenu";
import NodeName from "./NodeName";
import TooltipRow from "./TooltipRow";
import TooltipTable from "./TooltipTable";
import { SToggles, STreeNodeRow, SLeft, SRightActions, ICON_SIZE } from "./TreeNodeRow";
import VisibilityToggle from "./VisibilityToggle";
import {
  GetIsTreeNodeVisibleInTree,
  OnNamespaceOverrideColorChange,
  TreeTopicNode,
  TreeUINode,
} from "./types";

const TOGGLE_WRAPPER_SIZE = 24;
const OUTER_LEFT_MARGIN = 12;
const INNER_LEFT_MARGIN = 8;

export type NamespaceNode = {
  available: boolean;
  checked: boolean;
  hasNamespaceOverrideColorChanged: boolean;
  key: string;
  namespace: string;
  overrideColor?: Color;
  visibleInScene: boolean;
};

type Props = {
  children: NamespaceNode[];
  filterText: string;
  getIsTreeNodeVisibleInTree: GetIsTreeNodeVisibleInTree;
  isXSWidth: boolean;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
  topicNode: TreeTopicNode;
  width: number;
};

function NamespaceNodeRow({
  nodeKey,
  hasNamespaceOverrideColorChanged,
  namespace,
  checked,
  available,
  overrideColor,
  visibleInScene,
  rowWidth,
  isXSWidth,
  maxNodeNameLen,
  filterText,
  topicNodeAvailable,
  topicName,
  onNamespaceOverrideColorChange,
}: {
  nodeKey: string;
  hasNamespaceOverrideColorChanged: boolean;
  namespace: string;
  available: boolean;
  checked: boolean;
  overrideColor?: Color;
  visibleInScene: boolean;
  rowWidth: number;
  isXSWidth: boolean;
  maxNodeNameLen: number;
  filterText: string;
  topicNodeAvailable: boolean;
  topicName: string;
  onNamespaceOverrideColorChange: OnNamespaceOverrideColorChange;
}) {
  const { setHoveredMarkerMatchers } = useContext(ThreeDimensionalVizContext);
  const { toggleCheckAllAncestors, toggleNamespaceChecked } = useGuaranteedContext(
    TopicTreeContext,
    "TopicTreeContext",
  );

  const updateHoveredMarkerMatchers = useCallback(
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    (visible: boolean) => {
      if (visible) {
        setHoveredMarkerMatchers([
          { topic: topicName, checks: [{ markerKeyPath: ["ns"], value: namespace }] },
        ]);
      }
    },
    [namespace, setHoveredMarkerMatchers, topicName],
  );

  const onMouseLeave = useCallback(() => setHoveredMarkerMatchers([]), [setHoveredMarkerMatchers]);

  const onToggle = useCallback(() => {
    toggleNamespaceChecked({ topicName, namespace });
    updateHoveredMarkerMatchers(!visibleInScene);
  }, [toggleNamespaceChecked, topicName, namespace, updateHoveredMarkerMatchers, visibleInScene]);
  const onAltToggle = useCallback(() => {
    toggleCheckAllAncestors(nodeKey, topicName);
    updateHoveredMarkerMatchers(!visibleInScene);
  }, [toggleCheckAllAncestors, nodeKey, topicName, updateHoveredMarkerMatchers, visibleInScene]);

  return (
    <STreeNodeRow
      visibleInScene={visibleInScene}
      style={{
        width: rowWidth,
        marginLeft: `-${OUTER_LEFT_MARGIN}px`,
      }}
    >
      <SLeft data-testid={`ns~${namespace}`}>
        <NodeName
          isXSWidth={isXSWidth}
          maxWidth={maxNodeNameLen}
          displayName={namespace}
          topicName=""
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
          <VisibilityToggle
            // Some namespaces are statically available. But we want to make sure the parent topic is also available
            // before showing it as available.
            available={topicNodeAvailable && available}
            checked={checked}
            dataTest={`visibility-toggle~${nodeKey}`}
            onAltToggle={() => onAltToggle()}
            onToggle={() => onToggle()}
            overrideColor={overrideColor}
            visibleInScene={visibleInScene}
            onMouseEnter={() => updateHoveredMarkerMatchers(true)}
            onMouseLeave={onMouseLeave}
          />
        </SToggles>
        <NamespaceMenu
          disableBaseColumn={!available}
          hasNamespaceOverrideColorChanged={hasNamespaceOverrideColorChanged}
          namespace={namespace}
          nodeKey={nodeKey}
          onNamespaceOverrideColorChange={onNamespaceOverrideColorChange}
          overrideColor={overrideColor}
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
  isXSWidth,
  onNamespaceOverrideColorChange,
  topicNode,
  width,
}: Props): TreeUINode[] {
  const rowWidth = width - (isXSWidth ? 0 : TREE_SPACING * 2) - OUTER_LEFT_MARGIN;
  const togglesWidth = TOGGLE_WRAPPER_SIZE;
  const rightActionWidth = topicNode.available ? togglesWidth + ICON_SIZE : ICON_SIZE;
  const maxNodeNameLen = rowWidth - rightActionWidth - INNER_LEFT_MARGIN * 2;

  const commonRowProps = {
    rowWidth,
    isXSWidth,
    maxNodeNameLen,
    filterText,
    topicNodeAvailable: topicNode.available,
    onNamespaceOverrideColorChange,
    topicName: topicNode.topicName,
  };

  return children
    .filter(({ key }) => getIsTreeNodeVisibleInTree(key))
    .map(
      ({
        key,
        hasNamespaceOverrideColorChanged,
        namespace,
        checked,
        available,
        overrideColor,
        visibleInScene,
      }) => {
        const title = (
          <NamespaceNodeRow
            {...{
              hasNamespaceOverrideColorChanged,
              namespace,
              checked,
              available,
              overrideColor,
              visibleInScene,
              nodeKey: key,
              ...commonRowProps,
            }}
          />
        );
        return { key, title };
      },
    );
}
