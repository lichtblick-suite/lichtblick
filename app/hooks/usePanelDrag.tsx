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
import React, { useContext } from "react";
import { useDrag, ConnectDragSource, ConnectDragPreview } from "react-dnd";
import { MosaicDragType, MosaicWindowContext } from "react-mosaic-component";
import { useSelector, useDispatch } from "react-redux";
import { bindActionCreators } from "redux";

import { startDrag, endDrag } from "@foxglove/studio-base/actions/panels";
import { State } from "@foxglove/studio-base/reducers";
import { MosaicDropResult } from "@foxglove/studio-base/types/panels";

export type PanelDragObject = {
  deferredHide: number;
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

  const dispatch = useDispatch();
  const mosaicId = useSelector(({ mosaic }: State) => mosaic.mosaicId);
  const originalLayout = useSelector((state: State) => state.persistedState.panels.layout);
  const originalSavedProps = useSelector((state: State) => state.persistedState.panels.savedProps);
  const actions = React.useMemo(
    () => bindActionCreators({ startDrag, endDrag }, dispatch),
    [dispatch],
  );

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

      // The defer is necessary as the element must be present on start for HTML DnD to not cry
      const path = mosaicWindowActions.getPath();
      const deferredHide = _.defer(() => {
        actions.startDrag({ path, sourceTabId });
      });
      return { mosaicId, deferredHide };
    },
    end: (item, monitor) => {
      if (onDragEnd) {
        onDragEnd();
      }

      // If the hide call hasn't happened yet, cancel it
      window.clearTimeout(item.deferredHide);
      const ownPath = mosaicWindowActions.getPath();
      const dropResult = monitor.getDropResult() ?? {};
      const { position, path: destinationPath, tabId: targetTabId } = dropResult;
      if (panelId == undefined) {
        return;
      }

      actions.endDrag({
        originalLayout: originalLayout as any,
        originalSavedProps,
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
