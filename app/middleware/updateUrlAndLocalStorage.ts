// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { ActionTypes } from "@foxglove/studio-base/actions";
import { PANELS_ACTION_TYPES } from "@foxglove/studio-base/actions/panels";
import { State } from "@foxglove/studio-base/reducers";
import { setPersistedStateInLocalStorage } from "@foxglove/studio-base/reducers/panels";
import { Store } from "@foxglove/studio-base/types/Store";

let updateUrlTimer: ReturnType<typeof setTimeout> | undefined;

function maybeSetPersistedStateInLocalStorage(store: Store, skipSettingLocalStorage: boolean) {
  if (skipSettingLocalStorage) {
    return;
  }
  const state = store.getState();
  const persistedState = {
    ...state.persistedState,
  };
  setPersistedStateInLocalStorage(persistedState);
}

const {
  LOAD_LAYOUT,
  IMPORT_PANEL_LAYOUT,
  CHANGE_PANEL_LAYOUT,
  SAVE_PANEL_CONFIGS,
  SAVE_FULL_PANEL_CONFIG,
  CREATE_TAB_PANEL,
  OVERWRITE_GLOBAL_DATA,
  SET_GLOBAL_DATA,
  SET_USER_NODES,
  SET_LINKED_GLOBAL_VARIABLES,
  SET_PLAYBACK_CONFIG,
  CLOSE_PANEL,
  SPLIT_PANEL,
  SWAP_PANEL,
  MOVE_TAB,
  ADD_PANEL,
  DROP_PANEL,
  START_DRAG,
  END_DRAG,
} = PANELS_ACTION_TYPES;

const updateUrlActions = [
  LOAD_LAYOUT,
  IMPORT_PANEL_LAYOUT,
  CHANGE_PANEL_LAYOUT,
  SAVE_PANEL_CONFIGS,
  SAVE_FULL_PANEL_CONFIG,
  CREATE_TAB_PANEL,
  OVERWRITE_GLOBAL_DATA,
  SET_GLOBAL_DATA,
  SET_USER_NODES,
  SET_LINKED_GLOBAL_VARIABLES,
  SET_PLAYBACK_CONFIG,
  CLOSE_PANEL,
  SPLIT_PANEL,
  SWAP_PANEL,
  MOVE_TAB,
  ADD_PANEL,
  DROP_PANEL,
  START_DRAG,
  END_DRAG,
].map((item) => item.toString());

const updateUrlAndLocalStorageMiddlewareDebounced =
  (store: Store) =>
  (next: (action: ActionTypes) => State) =>
  (action: ActionTypes): State => {
    const result = next(action);
    // Any action that changes panels state should potentially trigger a URL update.
    let skipSettingLocalStorage = false;
    if (
      action.payload !== undefined &&
      typeof action.payload === "object" &&
      "skipSettingLocalStorage" in action.payload
    ) {
      skipSettingLocalStorage = Boolean(action.payload.skipSettingLocalStorage);
    }

    if (updateUrlActions.includes(action.type)) {
      if (updateUrlTimer) {
        clearTimeout(updateUrlTimer);
      }
      updateUrlTimer = setTimeout(async () => {
        maybeSetPersistedStateInLocalStorage(store, skipSettingLocalStorage);
        return result;
      }, 500);
    }

    maybeSetPersistedStateInLocalStorage(store, skipSettingLocalStorage);
    return result;
  };

export default updateUrlAndLocalStorageMiddlewareDebounced;
