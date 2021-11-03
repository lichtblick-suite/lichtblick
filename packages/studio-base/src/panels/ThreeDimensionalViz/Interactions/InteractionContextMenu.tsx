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

import { useCallback, useContext, useEffect } from "react";
import styled from "styled-components";

import { MouseEventObject } from "@foxglove/regl-worldview";
import {
  Interactive,
  SelectedObject,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/types";
import { ThreeDimensionalVizContext } from "@foxglove/studio-base/panels/ThreeDimensionalViz/ThreeDimensionalVizContext";
import { ClickedPosition } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicTree/Layout";
import {
  getInteractionData,
  getObject,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/threeDimensionalVizUtils";
import { BaseMarker } from "@foxglove/studio-base/types/Messages";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

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

const SId = styled.span`
  color: ${colors.YELLOW1};
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
  const object = getObject(interactiveObject) as Interactive<BaseMarker>;
  const topic = getInteractionData(interactiveObject)?.topic;
  const menuText = (
    <>
      {object.id != undefined && object.id !== "" && <SId>{object.id}</SId>}
      {object.interactionData?.topic}
    </>
  );

  const { setHoveredMarkerMatchers } = useContext(ThreeDimensionalVizContext);
  const onMouseEnter = useCallback(() => {
    if (topic) {
      const { id, ns } = object;
      const checks = [{ markerKeyPath: ["id"], value: id }];
      if (ns != undefined && ns !== "") {
        checks.push({ markerKeyPath: ["ns"], value: ns });
      }
      return setHoveredMarkerMatchers([{ topic, checks }]);
    }
  }, [object, setHoveredMarkerMatchers, topic]);
  const onMouseLeave = useCallback(() => setHoveredMarkerMatchers([]), [setHoveredMarkerMatchers]);
  useEffect(() => onMouseLeave, [onMouseLeave]);

  const selectItemObject = useCallback(
    () => selectObject(interactiveObject as SelectedObject),
    [interactiveObject, selectObject],
  );

  return (
    <SMenuItem
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-test="InteractionContextMenuItem"
    >
      <STopic onClick={selectItemObject}>
        {menuText}
        <STooltip>{menuText}</STooltip>
      </STopic>
    </SMenuItem>
  );
}
