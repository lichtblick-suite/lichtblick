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
import { ActionTypes } from "@foxglove-studio/app/actions";
import { State } from "@foxglove-studio/app/reducers";

export default function hoverValueReducer(state: State, action: ActionTypes): State {
  switch (action.type) {
    case "SET_HOVER_VALUE":
      return { ...state, hoverValue: action.payload.value };
    case "CLEAR_HOVER_VALUE":
      if (state.hoverValue?.componentId === action.payload.componentId) {
        return { ...state, hoverValue: undefined };
      }
      break;
    default:
      break;
  }
  return state;
}
