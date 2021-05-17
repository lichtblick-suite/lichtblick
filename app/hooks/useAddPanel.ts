// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedPanelIds } from "@foxglove/studio-base/actions/mosaic";
import { addPanel } from "@foxglove/studio-base/actions/panels";
import { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import { usePanelSettings } from "@foxglove/studio-base/context/PanelSettingsContext";
import { State as ReduxState } from "@foxglove/studio-base/reducers";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";
import logEvent, { getEventNames, getEventTags } from "@foxglove/studio-base/util/logEvent";

export default function useAddPanel(): (selection: PanelSelection) => void {
  const dispatch = useDispatch();
  const layout = useSelector((state: ReduxState) => state.persistedState.panels.layout);
  const { openPanelSettings } = usePanelSettings();
  return useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      const id = getPanelIdForType(type);
      dispatch(addPanel({ id, layout, config, relatedConfigs }));
      dispatch(setSelectedPanelIds([id]));
      openPanelSettings();

      const name = getEventNames().PANEL_ADD;
      const panelType = getEventTags().PANEL_TYPE;
      if (name != undefined && panelType != undefined) {
        logEvent({ name: name, tags: { [panelType]: type } });
      }
    },
    [dispatch, layout, openPanelSettings],
  );
}
