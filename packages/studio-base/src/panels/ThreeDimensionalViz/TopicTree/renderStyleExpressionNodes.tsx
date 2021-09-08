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

import DotsVerticalIcon from "@mdi/svg/svg/dots-vertical.svg";
import EarthIcon from "@mdi/svg/svg/earth.svg";
import { groupBy, defaults } from "lodash";
import { useCallback, useContext, useMemo } from "react";
import styled from "styled-components";

import { filterMap } from "@foxglove/den/collection";
import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import Icon from "@foxglove/studio-base/components/Icon";
import Menu, { Item } from "@foxglove/studio-base/components/Menu";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { getDefaultColorOverrideBySourceIdx } from "@foxglove/studio-base/panels/ThreeDimensionalViz/GlobalVariableStyles";
import { LinkedGlobalVariable } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import { ThreeDimensionalVizContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import { ColorOverride } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import TooltipRow from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/TooltipRow";
import TooltipTable from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/TooltipTable";
import { TreeUINode } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/types";
import { SECOND_SOURCE_PREFIX } from "@foxglove/studio-base/util/globalConstants";
import { joinTopics } from "@foxglove/studio-base/util/topicUtils";

import { SLeft, SRightActions, SToggles, STreeNodeRow } from "./TreeNodeRow";
import VisibilityToggle from "./VisibilityToggle";
import { TREE_SPACING, ROW_HEIGHT } from "./constants";

// TODO: Dedupe from renderNamespaceNodes
const OUTER_LEFT_MARGIN = 12;

export const SDisplayName = styled.div`
  font-size: 13px;
  line-height: 1.4;
  margin: 0 4px;
  word-break: break-word;
  /* disallow selection to prevent shift + click from accidentally select */
  user-select: none;
  width: 100%;
`;

export function renderStyleExpressionNodes({
  width,
  isXSWidth,
  topicName,
  hasFeatureColumn,
  linkedGlobalVariablesByTopic,
}: {
  width: number;
  isXSWidth: boolean;
  topicName: string;
  hasFeatureColumn: boolean;
  linkedGlobalVariablesByTopic: Record<string, LinkedGlobalVariable[]>;
}): TreeUINode[] {
  const rowWidth = width - (isXSWidth ? 0 : TREE_SPACING * 2) - OUTER_LEFT_MARGIN;
  const linkedGlobalVariablesByVariableName = groupBy(
    linkedGlobalVariablesByTopic[topicName] ?? [],
    ({ name }) => name,
  );
  return Object.entries(linkedGlobalVariablesByVariableName).map(
    ([variableName, variables], rowIndex) => {
      const title = (
        <StyleExpressionNode
          linkedGlobalVariables={variables}
          topic={topicName}
          hasFeatureColumn={hasFeatureColumn}
          rowWidth={rowWidth}
          rowIndex={rowIndex}
          variableName={variableName}
        />
      );
      return { key: `${topicName}~${variableName}`, title };
    },
  );
}

const SItemContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

function StyleExpressionNode(props: {
  linkedGlobalVariables: LinkedGlobalVariable[];
  topic: string;
  hasFeatureColumn: boolean;
  rowWidth: number;
  rowIndex: number;
  variableName: string;
}) {
  const { topic, rowWidth, rowIndex, hasFeatureColumn, linkedGlobalVariables } = props;

  const {
    colorOverrideBySourceIdxByVariable,
    setColorOverrideBySourceIdxByVariable,
    setHoveredMarkerMatchers,
  } = useContext(ThreeDimensionalVizContext);

  const { globalVariables } = useGlobalVariables();
  const { markerKeyPath, name } = linkedGlobalVariables[0]!;

  const value = globalVariables[name];
  const colorOverridesByColumnIdx: (ColorOverride | undefined)[] = defaults(
    [],
    colorOverrideBySourceIdxByVariable[name],
    getDefaultColorOverrideBySourceIdx(rowIndex),
  );
  const activeRowActive = colorOverridesByColumnIdx.some((colorOverride) => colorOverride?.active);

  // Callbacks
  const updateSettingsForGlobalVariable = useCallback(
    (globalVariableName: string, settings: ColorOverride, sourceIdx: number = 0) => {
      const updatedSettings = new Array(2)
        .fill(0)
        .map((_, i) => colorOverrideBySourceIdxByVariable[globalVariableName]?.[i] ?? {});
      updatedSettings[sourceIdx] = settings;
      setColorOverrideBySourceIdxByVariable({
        ...colorOverrideBySourceIdxByVariable,
        [globalVariableName]: updatedSettings,
      });
    },
    [colorOverrideBySourceIdxByVariable, setColorOverrideBySourceIdxByVariable],
  );

  // Mouse-hover handlers
  const onMouseLeave = useCallback(() => setHoveredMarkerMatchers([]), [setHoveredMarkerMatchers]);
  const mouseEventHandlersByColumnIdx = useMemo(() => {
    const topicNameByColumnIdx = [topic, joinTopics(SECOND_SOURCE_PREFIX, topic)];
    return topicNameByColumnIdx.map((_topic) => ({
      onMouseEnter: () =>
        setHoveredMarkerMatchers([{ topic: _topic, checks: [{ markerKeyPath, value }] }]),
      onMouseLeave,
    }));
  }, [markerKeyPath, onMouseLeave, setHoveredMarkerMatchers, topic, value]);

  const tooltipContent = (
    <TooltipRow>
      <TooltipTable>
        <tbody>
          <tr>
            <th>Topic:</th>
            <td>
              <code>{topic}</code>
            </td>
          </tr>
          <tr>
            <th>Expression:</th>
            <td>
              <code>
                .{markerKeyPath.join(".")} == {value}
              </code>
            </td>
          </tr>
        </tbody>
      </TooltipTable>
    </TooltipRow>
  );

  return (
    <STreeNodeRow
      visibleInScene={activeRowActive}
      style={{
        width: rowWidth,
        marginLeft: `-${OUTER_LEFT_MARGIN}px`,
      }}
    >
      <SLeft data-test={`ns~${name}`}>
        <Icon style={{ color: "rgba(255,255,255, 0.3)" }}>
          <EarthIcon style={{ width: 16, height: 16 }} />
        </Icon>
        <Tooltip contents={tooltipContent} placement="top">
          <SDisplayName>
            .{markerKeyPath.join(".")} == ${name}
          </SDisplayName>
        </Tooltip>
      </SLeft>
      <SRightActions>
        {colorOverridesByColumnIdx != undefined && (
          <SToggles>
            {filterMap(colorOverridesByColumnIdx, (override, sourceIdx) => {
              if (!hasFeatureColumn && sourceIdx === 1) {
                return ReactNull;
              }
              const { active = false, color } = override ?? {};
              return (
                <VisibilityToggle
                  available={true}
                  checked={active}
                  dataTest={`visibility-toggle T:${topic} ${name} ${sourceIdx}`}
                  key={sourceIdx}
                  onAltToggle={() =>
                    updateSettingsForGlobalVariable(name, { active: !active, color }, sourceIdx)
                  }
                  onToggle={() =>
                    updateSettingsForGlobalVariable(name, { active: !active, color }, sourceIdx)
                  }
                  overrideColor={color}
                  size="SMALL"
                  unavailableTooltip={""}
                  visibleInScene={active}
                  diffModeEnabled={false}
                  columnIndex={sourceIdx}
                  {...mouseEventHandlersByColumnIdx[sourceIdx]}
                />
              );
            })}
          </SToggles>
        )}
        <ChildToggle position="below" dataTest={`topic-row-menu-${topic}`}>
          <Icon
            size="small"
            fade
            style={{
              padding: "4px 0px",
              height: ROW_HEIGHT,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <DotsVerticalIcon />
          </Icon>
          <Menu>
            <Item style={{ padding: "0 12px", height: 28 }}>
              <SItemContent>
                <span style={{ paddingRight: 8 }}>Marker color</span>
                <ColorPicker
                  color={colorOverridesByColumnIdx[0]?.color}
                  buttonShape={"circle"}
                  onChange={(color) => {
                    const active = colorOverridesByColumnIdx[0]?.active;
                    updateSettingsForGlobalVariable(name, { color, active }, 0);
                  }}
                />
              </SItemContent>
            </Item>
            {hasFeatureColumn && (
              <Item style={{ padding: "0 12px", height: 28 }}>
                <SItemContent>
                  <span style={{ paddingRight: 8 }}>Feature marker color</span>
                  <ColorPicker
                    color={colorOverridesByColumnIdx[1]?.color}
                    buttonShape={"circle"}
                    onChange={(color) => {
                      const active = colorOverridesByColumnIdx[1]?.active;
                      updateSettingsForGlobalVariable(name, { color, active }, 1);
                    }}
                  />
                </SItemContent>
              </Item>
            )}
          </Menu>
        </ChildToggle>
      </SRightActions>
    </STreeNodeRow>
  );
}
