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

import { createStore, applyMiddleware, Reducer } from "redux";
import thunk, { ThunkDispatch } from "redux-thunk";

import { ActionTypes } from "@foxglove/studio-base/actions";
import { State } from "@foxglove/studio-base/reducers";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const configureStore = (
  reducer: Reducer<State, ActionTypes>,
  middleware: Array<any> = [],
  _history?: unknown,
) => {
  const store = createStore(
    reducer,
    undefined,
    applyMiddleware<ThunkDispatch<State, undefined, ActionTypes>>(thunk, ...middleware),
  );

  return store;
};

export default configureStore;
