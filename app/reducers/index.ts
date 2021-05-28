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

import { Reducer } from "redux";
import { ThunkAction } from "redux-thunk";

import { ActionTypes } from "@foxglove/studio-base/actions";
import { ros_lib_dts } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/ros";
import userNodes, { UserNodeDiagnostics } from "@foxglove/studio-base/reducers/userNodes";

const getReducers = () => [userNodes];

export type Dispatcher<A extends ActionTypes> = ThunkAction<void, State, undefined, A>;

export type State = {
  userNodes: { userNodeDiagnostics: UserNodeDiagnostics; rosLib: string };
};

export default function createRootReducer(): Reducer<State, ActionTypes> {
  const initialState: State = {
    userNodes: {
      userNodeDiagnostics: {
        diagnostics: [],
        logs: [],
      },
      rosLib: ros_lib_dts,
    },
  };
  return (state: State | undefined, action: ActionTypes): State => {
    return getReducers().reduce((builtState, reducer) => reducer(builtState, action), {
      ...initialState,
      ...state,
    });
  };
}
