// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useCallback } from "react";
import { useDrop } from "react-dnd";
import { MosaicDragType } from "react-mosaic-component";
import styled from "styled-components";

import EmptyBoxSvg from "@foxglove/studio-base/assets/emptyBox.svg";
import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import Menu from "@foxglove/studio-base/components/Menu";
import PanelList, { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { MosaicDropResult } from "@foxglove/studio-base/types/panels";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const SDropTarget = styled.div<{ isOver: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: ${({ isOver, theme }) =>
    isOver ? theme.palette.neutralLighterAlt : "transparent"};
  border: ${({ isOver, theme }) => (isOver ? `1px solid ${theme.palette.neutralLight}` : "none")};
`;

const SEmptyStateText = styled.div`
  font-size: 16px;
  margin: 16px 72px;
  text-align: center;
  line-height: 1.5;
  color: ${({ theme }) => theme.semanticColors.disabledText};
`;

const SPickAPanelText = styled.div`
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.1s;

  &:hover {
    color: ${colors.TEXTL1};
  }
`;

type Props = {
  tabId?: string;
};

export const EmptyDropTarget = ({ tabId }: Props): JSX.Element => {
  const { addPanel } = useCurrentLayoutActions();

  const [{ isOver }, drop] = useDrop<unknown, MosaicDropResult, { isOver: boolean }>({
    accept: MosaicDragType.WINDOW,
    drop: () => {
      return { tabId };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const onPanelSelect = useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      const id = getPanelIdForType(type);
      addPanel({ tabId, id, config, relatedConfigs });
    },
    [addPanel, tabId],
  );

  return (
    <SDropTarget ref={drop} isOver={isOver} data-test="empty-drop-target">
      <EmptyBoxSvg />
      <SEmptyStateText>
        Nothing here yet.
        <br />
        <ChildToggle position="below" style={{ display: "inline-flex" }}>
          <SPickAPanelText data-test="pick-a-panel">Pick a panel</SPickAPanelText>
          <Menu>
            <PanelList onPanelSelect={onPanelSelect} />
          </Menu>
        </ChildToggle>{" "}
        or drag one in to get started.
      </SEmptyStateText>
    </SDropTarget>
  );
};
