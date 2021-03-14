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
import { uniq } from "lodash";
import { getLeaves } from "react-mosaic-component";

import { ActionTypes } from "@foxglove-studio/app/actions";
import { State } from "@foxglove-studio/app/reducers";

export default function mosaicReducer(state: State, action: ActionTypes): State {
  switch (action.type) {
    case "SET_MOSAIC_ID":
      return { ...state, mosaic: { ...state.mosaic, mosaicId: action.payload } };
    case "ADD_SELECTED_PANEL_ID":
      return {
        ...state,
        mosaic: {
          ...state.mosaic,
          selectedPanelIds: uniq<string | number>([
            ...state.mosaic.selectedPanelIds,
            action.payload,
          ]),
        },
      };
    case "REMOVE_SELECTED_PANEL_ID":
      return {
        ...state,
        mosaic: {
          ...state.mosaic,
          selectedPanelIds: state.mosaic.selectedPanelIds.filter((id) => id !== action.payload),
        },
      };
    case "SET_SELECTED_PANEL_IDS":
      return { ...state, mosaic: { ...state.mosaic, selectedPanelIds: action.payload } };
    case "SELECT_ALL_PANELS":
      return {
        ...state,
        mosaic: {
          ...state.mosaic,
          selectedPanelIds: getLeaves(state.persistedState.panels.layout ?? null),
        },
      };
    default:
      return { ...state, mosaic: state.mosaic };
  }
}
