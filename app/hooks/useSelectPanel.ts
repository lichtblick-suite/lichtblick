// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addPanel } from "@foxglove-studio/app/actions/panels";
import { PanelSelection } from "@foxglove-studio/app/components/PanelList";
import { State as ReduxState } from "@foxglove-studio/app/reducers";
import logEvent, { getEventNames, getEventTags } from "@foxglove-studio/app/util/logEvent";

export default function useSelectPanel(): (selection: PanelSelection) => void {
  const dispatch = useDispatch();
  const layout = useSelector((state: ReduxState) => state.persistedState.panels.layout);
  return useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      dispatch(addPanel({ type, layout, config, relatedConfigs }));

      const name = getEventNames().PANEL_ADD;
      const panelType = getEventTags().PANEL_TYPE;
      if (name != undefined && panelType != undefined) {
        logEvent({ name: name, tags: { [panelType]: type } });
      }
    },
    [dispatch, layout],
  );
}
