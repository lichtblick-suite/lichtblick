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
import { useDispatch } from "react-redux";
import styled from "styled-components";

import { addPanel } from "@foxglove-studio/app/actions/panels";
import EmptyBoxSvg from "@foxglove-studio/app/assets/emptyBox.svg";
import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Menu from "@foxglove-studio/app/components/Menu";
import PanelList, { PanelSelection } from "@foxglove-studio/app/components/PanelList";
import cssColors from "@foxglove-studio/app/styles/colors.module.scss";
import logEvent, { getEventNames, getEventTags } from "@foxglove-studio/app/util/logEvent";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

const SDropTarget = styled.div<{ isOver: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: ${({ isOver }: any) => (isOver ? cssColors.textDisabled : "transparent")};
  border: ${({ isOver }: any) => (isOver ? `1px solid ${cssColors.textMuted}` : "none")};
`;

const SEmptyStateText = styled.div`
  font-size: 16px;
  margin: 16px 72px;
  text-align: center;
  line-height: 1.5;
  color: rgba(247, 247, 243, 0.3);
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
  mosaicId?: string;
  tabId?: string;
};

export const EmptyDropTarget = ({ mosaicId, tabId }: Props) => {
  const dispatch = useDispatch();

  const [{ isOver }, drop] = useDrop({
    accept: MosaicDragType.WINDOW,
    drop: (_item, monitor) => {
      if (monitor.getItem().mosaicId === mosaicId) {
        return { tabId };
      }
      return undefined;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const onPanelSelect = useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      dispatch(addPanel({ tabId, type, layout: undefined, config, relatedConfigs }));
      const name = getEventNames().PANEL_ADD;
      const eventType = getEventTags().PANEL_TYPE;
      if (name != undefined && eventType != undefined) {
        logEvent({ name, tags: { [eventType]: type } });
      }
    },
    [dispatch, tabId],
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
        {" or drag one in to get started."}
      </SEmptyStateText>
    </SDropTarget>
  );
};
