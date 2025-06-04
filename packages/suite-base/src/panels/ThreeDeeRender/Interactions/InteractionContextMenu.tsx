// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Menu, MenuItem, MenuProps } from "@mui/material";
import { useCallback } from "react";

import { BaseMarker, InstancedLineListMarker } from "@lichtblick/suite-base/types/Messages";

import { Interactive, SelectedObject } from "./types";
import { MouseEventObject } from "../camera";

type ClickedPosition = { clientX: number; clientY: number };

type Props = {
  clickedPosition: ClickedPosition;
  clickedObjects: MouseEventObject[];
  onClose: MenuProps["onClose"];
  selectObject: (arg0?: MouseEventObject) => void;
};

const getInstanceObj = (marker: unknown, idx: number): unknown => {
  if (marker == undefined) {
    return;
  }
  return (marker as InstancedLineListMarker).metadataByIndex?.[idx];
};

const getObject = (selectedObject?: MouseEventObject): unknown => {
  const object =
    (selectedObject?.instanceIndex != undefined &&
      (selectedObject.object as InstancedLineListMarker).metadataByIndex != undefined &&
      getInstanceObj(selectedObject.object, selectedObject.instanceIndex) != undefined) ||
    selectedObject?.object;
  return object;
};

function InteractionContextMenuItem({
  interactiveObject,
  selectObject,
}: {
  selectObject: (arg0?: SelectedObject) => void;
  interactiveObject?: MouseEventObject;
}): React.JSX.Element {
  const object = getObject(interactiveObject) as Partial<Interactive<BaseMarker>>;

  const selectItemObject = useCallback(() => {
    selectObject(interactiveObject as SelectedObject);
  }, [interactiveObject, selectObject]);

  return (
    <MenuItem data-test="InteractionContextMenuItem" onClick={selectItemObject}>
      {object.interactionData?.topic}
    </MenuItem>
  );
}

export function InteractionContextMenu({
  clickedObjects = [],
  clickedPosition = { clientX: 0, clientY: 0 },
  onClose,
  selectObject,
}: Props): React.JSX.Element {
  return (
    <Menu
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{
        top: clickedPosition.clientY,
        left: clickedPosition.clientX,
      }}
      slotProps={{
        list: {
          dense: true,
        },
      }}
    >
      {clickedObjects.map((interactiveObject, index) => (
        <InteractionContextMenuItem
          key={index}
          interactiveObject={interactiveObject}
          selectObject={selectObject}
        />
      ))}
    </Menu>
  );
}
