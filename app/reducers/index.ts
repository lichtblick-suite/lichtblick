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
import { v4 as uuidv4 } from "uuid";

import { ActionTypes } from "@foxglove-studio/app/actions";
import { ros_lib_dts } from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typescript/ros";
import hoverValue from "@foxglove-studio/app/reducers/hoverValue";
import layoutHistory, {
  LayoutHistory,
  initialLayoutHistoryState,
} from "@foxglove-studio/app/reducers/layoutHistory";
import mosaic from "@foxglove-studio/app/reducers/mosaic";
import panels, {
  PanelsState,
  getInitialPersistedStateAndMaybeUpdateLocalStorageAndURL,
} from "@foxglove-studio/app/reducers/panels";
import recentLayouts, {
  maybeStoreNewRecentLayout,
} from "@foxglove-studio/app/reducers/recentLayouts";
import tests from "@foxglove-studio/app/reducers/tests";
import userNodes, { UserNodeDiagnostics } from "@foxglove-studio/app/reducers/userNodes";
import { Auth as AuthState } from "@foxglove-studio/app/types/Auth";
import { HoverValue } from "@foxglove-studio/app/types/hoverValue";
import { SetFetchedLayoutPayload } from "@foxglove-studio/app/types/panels";

const getReducers = () => [
  panels,
  mosaic,
  hoverValue,
  userNodes,
  layoutHistory,
  recentLayouts,
  ...(process.env.NODE_ENV === "test" ? [tests] : []),
];

export type PersistedState = {
  panels: PanelsState;
  fetchedLayout: SetFetchedLayoutPayload;
  search?: string;
};

export type Dispatcher<A extends ActionTypes> = ThunkAction<void, State, undefined, A>;

export type State = {
  persistedState: PersistedState;
  mosaic: { mosaicId: string; selectedPanelIds: string[] };
  auth: AuthState;
  hoverValue?: HoverValue;
  userNodes: { userNodeDiagnostics: UserNodeDiagnostics; rosLib: string };
  layoutHistory: LayoutHistory;
  commenting: {
    fetchedCommentsBase: Comment[];
    fetchedCommentsFeature: Comment[];
    sourceToShow: string;
  };
};

export default function createRootReducer(args?: { testAuth?: any }): Reducer<State, ActionTypes> {
  const persistedState = getInitialPersistedStateAndMaybeUpdateLocalStorageAndURL();
  maybeStoreNewRecentLayout(persistedState);
  const initialState: State = {
    persistedState,
    mosaic: {
      // We use the same mosaicId for all mosaics to support dragging and dropping between them
      mosaicId: uuidv4(),
      selectedPanelIds: [],
    },
    auth: Object.freeze(args?.testAuth || { username: undefined }),
    hoverValue: undefined,
    userNodes: {
      userNodeDiagnostics: {
        diagnostics: [],
        logs: [],
      },
      rosLib: ros_lib_dts,
    },
    layoutHistory: initialLayoutHistoryState,
    commenting: { fetchedCommentsBase: [], fetchedCommentsFeature: [], sourceToShow: "Both" },
  };
  return (state: State | undefined, action: ActionTypes): State => {
    const oldPersistedState: PersistedState | undefined = state?.persistedState;
    const reducers: Array<(arg0: State, arg1: ActionTypes, arg2?: PersistedState) => State> =
      getReducers() as any;
    return reducers.reduce(
      (builtState, reducer) => reducer(builtState, action, oldPersistedState),
      {
        ...initialState,
        ...state,
      },
    );
  };
}
