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

import _ from "lodash";
import { useContext } from "react";
import { useDrag, ConnectDragSource, ConnectDragPreview } from "react-dnd";
import { MosaicDragType, MosaicNode, MosaicWindowContext } from "react-mosaic-component";

import {
  useCurrentLayoutActions,
  usePanelMosaicId,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { MosaicDropResult, SavedProps } from "@foxglove/studio-base/types/panels";

type PanelDragObject = {
  deferredHide: number;
  originalLayout: MosaicNode<string> | undefined;
  originalConfigById: SavedProps;
};

// Hook to integrate mosaic drag functionality into any other component
export default function usePanelDrag(props: {
  tabId?: string;
  panelId?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}): [ConnectDragSource, ConnectDragPreview] {
  const { tabId: sourceTabId, panelId, onDragStart, onDragEnd } = props;
  const { mosaicWindowActions } = useContext(MosaicWindowContext);

  const mosaicId = usePanelMosaicId();

  const { getCurrentLayoutState: getCurrentLayout, startDrag, endDrag } = useCurrentLayoutActions();

  const [, connectDragSource, connectDragPreview] = useDrag<
    PanelDragObject,
    MosaicDropResult,
    never
  >({
    type: MosaicDragType.WINDOW,
    item: () => {
      if (onDragStart) {
        onDragStart();
      }

      const { selectedLayout } = getCurrentLayout();
      if (!selectedLayout?.data) {
        // eslint-disable-next-line no-restricted-syntax
        return null;
      }

      const { layout: originalLayout, configById: originalConfigById } = selectedLayout.data;

      // The defer is necessary as the element must be present on start for HTML DnD to not cry
      const path = mosaicWindowActions.getPath();
      const deferredHide = _.defer(() => {
        startDrag({ path, sourceTabId });
      });
      return { mosaicId, deferredHide, originalLayout, originalConfigById };
    },
    end: (item, monitor) => {
      if (onDragEnd) {
        onDragEnd();
      }
      if (item.originalLayout == undefined) {
        return;
      }

      // If the hide call hasn't happened yet, cancel it
      window.clearTimeout(item.deferredHide);
      const ownPath = mosaicWindowActions.getPath();
      const dropResult = monitor.getDropResult() ?? {};
      const { position, path: destinationPath, tabId: targetTabId } = dropResult;
      if (panelId == undefined) {
        return;
      }

      endDrag({
        originalLayout: item.originalLayout,
        originalSavedProps: item.originalConfigById,
        panelId,
        sourceTabId,
        targetTabId,
        position,
        destinationPath,
        ownPath,
      });
    },
  });

  return [connectDragSource, connectDragPreview];
}
