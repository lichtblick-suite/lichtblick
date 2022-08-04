// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useCallback } from "react";
import styled from "styled-components";

import { getObject } from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { BaseMarker } from "@foxglove/studio-base/types/Messages";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import { MouseEventObject } from "../camera";
import { Interactive, SelectedObject } from "./types";

type ClickedPosition = { clientX: number; clientY: number };

const SInteractionContextMenu = styled.div`
  position: fixed;
  width: 240px;
  color: ${colors.LIGHT1};
  background: ${colors.DARK4};
  opacity: 0.9;
  z-index: 101; /* above the Text marker */
`;

const SMenu = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const STooltip = styled.div`
  cursor: pointer;
  background: ${colors.PURPLE1};
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  padding: 8px;
`;

const SMenuItem = styled.li`
  cursor: pointer;
  padding: 8px;
  position: relative;
  &:hover {
    background: ${colors.PURPLE1};
    ${STooltip} {
      display: block;
    }
  }
`;

const STopic = styled.div`
  width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

type Props = {
  clickedPosition: ClickedPosition;
  clickedObjects: MouseEventObject[];
  selectObject: (arg0?: MouseEventObject) => void;
};

export default function InteractionContextMenu({
  clickedObjects = [],
  clickedPosition = { clientX: 0, clientY: 0 },
  selectObject,
}: Props): JSX.Element {
  return (
    <SInteractionContextMenu
      style={{
        top: clickedPosition.clientY,
        left: clickedPosition.clientX,
      }}
    >
      <SMenu>
        {clickedObjects.map((interactiveObject, index) => (
          <InteractionContextMenuItem
            key={index}
            interactiveObject={interactiveObject}
            selectObject={selectObject}
          />
        ))}
      </SMenu>
    </SInteractionContextMenu>
  );
}

function InteractionContextMenuItem({
  interactiveObject,
  selectObject,
}: {
  selectObject: (arg0?: SelectedObject) => void;
  interactiveObject?: MouseEventObject;
}) {
  const object = getObject(interactiveObject) as Partial<Interactive<BaseMarker>>;
  const menuText = <>{object.interactionData?.topic}</>;

  const selectItemObject = useCallback(
    () => selectObject(interactiveObject as SelectedObject),
    [interactiveObject, selectObject],
  );

  return (
    <SMenuItem data-testid="InteractionContextMenuItem">
      <STopic onClick={selectItemObject}>
        {menuText}
        <STooltip>{menuText}</STooltip>
      </STopic>
    </SMenuItem>
  );
}
