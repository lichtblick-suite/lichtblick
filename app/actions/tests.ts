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

import { PersistedState, Dispatcher } from "@foxglove/studio-base/reducers";
import { Auth as AuthState } from "@foxglove/studio-base/types/Auth";

export type TEST_SET_PERSISTED_STATE = {
  type: "TEST_SET_PERSISTED_STATE";
  payload: PersistedState;
};
export type TEST_SET_AUTH_STATE = { type: "TEST_SET_AUTH_STATE"; payload: AuthState };

export enum TEST_ACTION_TYPES {
  TEST_SET_PERSISTED_STATE = "TEST_SET_PERSISTED_STATE",
  TEST_SET_AUTH_STATE = "TEST_SET_AUTH_STATE",
}

export const testOverwritePersistedState =
  (payload: PersistedState): Dispatcher<TEST_SET_PERSISTED_STATE> =>
  (dispatch) => {
    return dispatch({ type: TEST_ACTION_TYPES.TEST_SET_PERSISTED_STATE, payload });
  };

export const testOverwriteAuthState =
  (payload: AuthState): Dispatcher<TEST_SET_AUTH_STATE> =>
  (dispatch) => {
    return dispatch({ type: TEST_ACTION_TYPES.TEST_SET_AUTH_STATE, payload });
  };

export type TestsActions = TEST_SET_PERSISTED_STATE | TEST_SET_AUTH_STATE;
