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
import { useState } from "react";
import styled from "styled-components";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import Icon from "@foxglove/studio-base/components/Icon";
import KeyboardShortcut from "@foxglove/studio-base/components/KeyboardShortcut";
import Menu, { Item } from "@foxglove/studio-base/components/Menu";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ROW_HEIGHT } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/constants";
import { TopicTreeContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/useTopicTree";
import clipboard from "@foxglove/studio-base/util/clipboard";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { SetCurrentEditingTopic } from "./types";

const DISABLED_STYLE = { cursor: "not-allowed", color: colors.TEXT_MUTED };

const SItemContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

type Props = {
  datatype?: string;
  disableBaseColumn: boolean;
  disableFeatureColumn: boolean;
  hasFeatureColumn: boolean;
  nodeKey: string;
  providerAvailable: boolean;
  setCurrentEditingTopic: SetCurrentEditingTopic;
  topicName: string;
};

export const DOT_MENU_WIDTH = 18; // The width of the small icon.

export default function TreeNodeMenu({
  datatype,
  disableBaseColumn,
  disableFeatureColumn,
  hasFeatureColumn,
  nodeKey,
  providerAvailable,
  setCurrentEditingTopic,
  topicName,
}: Props): JSX.Element | ReactNull {
  const [isOpen, setIsOpen] = useState(false);

  const { toggleCheckAllAncestors, toggleCheckAllDescendants } = useGuaranteedContext(
    TopicTreeContext,
    "TopicTreeContext",
  );

  // Don't render the dot menu if the datasources are unavailable and the node is group node (topic node has option to copy topicName).
  if (!providerAvailable && topicName.length === 0) {
    return ReactNull;
  }
  return (
    <ChildToggle
      position="below"
      isOpen={isOpen}
      onToggle={setIsOpen}
      dataTest={`topic-row-menu-${topicName}`}
    >
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
        {providerAvailable && (
          <>
            <Item
              style={{ padding: "0 12px", ...(disableBaseColumn ? DISABLED_STYLE : undefined) }}
              onClick={() => {
                if (disableBaseColumn) {
                  return;
                }
                toggleCheckAllAncestors(nodeKey, 0);
                setIsOpen(false);
              }}
            >
              <SItemContent>
                <span style={{ paddingRight: 8 }}>Toggle ancestors</span>
                <KeyboardShortcut keys={["Alt", "Enter"]} />
              </SItemContent>
            </Item>
            <Item
              style={{ padding: "0 12px", ...(disableBaseColumn ? DISABLED_STYLE : undefined) }}
              onClick={() => {
                if (disableBaseColumn) {
                  return;
                }
                toggleCheckAllDescendants(nodeKey, 0);
                setIsOpen(false);
              }}
            >
              <SItemContent>
                <span style={{ paddingRight: 8 }}>Toggle descendants</span>
                <KeyboardShortcut keys={["Shift", "Enter"]} />
              </SItemContent>
            </Item>
            {hasFeatureColumn && (
              <>
                <Item
                  style={disableFeatureColumn ? DISABLED_STYLE : {}}
                  onClick={() => {
                    if (disableFeatureColumn) {
                      return;
                    }
                    toggleCheckAllAncestors(nodeKey, 1);
                    setIsOpen(false);
                  }}
                >
                  Toggle feature ancestors
                </Item>
                <Item
                  style={disableFeatureColumn ? DISABLED_STYLE : {}}
                  onClick={() => {
                    if (disableFeatureColumn) {
                      return;
                    }
                    toggleCheckAllDescendants(nodeKey, 1);
                    setIsOpen(false);
                  }}
                >
                  Toggle feature descendants
                </Item>
              </>
            )}
          </>
        )}
        {topicName.length > 0 && (
          <Item
            onClick={() => {
              void clipboard.copy(topicName);
              setIsOpen(false);
            }}
          >
            Copy topic name
          </Item>
        )}
        {datatype && (
          <Item
            dataTest={`topic-row-menu-edit-settings-${topicName}`}
            onClick={() => {
              setCurrentEditingTopic({ name: topicName, datatype });
              setIsOpen(false);
            }}
          >
            Edit topic settings
          </Item>
        )}
      </Menu>
    </ChildToggle>
  );
}
