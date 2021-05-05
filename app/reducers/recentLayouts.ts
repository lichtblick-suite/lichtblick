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
import { panelEditingActions } from "@foxglove-studio/app/actions/panels";
import { State, PersistedState } from "@foxglove-studio/app/reducers";
import Storage from "@foxglove-studio/app/util/Storage";

const storage = new Storage();
const LOCALSTORAGE_KEY = "recentLayouts";
const LAYOUT_COUNT_STORED = 10;

// We ONLY save the name, and not the version here, because if the user selects a layout, we just want the most recent
// version of that layout.
type RecentLayoutId = string;
function recentLayoutFromPersistedState(state: PersistedState): RecentLayoutId | undefined {
  return state.fetchedLayout.data?.name;
}

// We ALWAYS read from localStorage here, because multiple tabs could be writing to recent layouts.
// Note that changes to recent layouts will not force a re-render.
export function getRecentLayouts(): RecentLayoutId[] {
  return storage.getItem(LOCALSTORAGE_KEY) ?? [];
}

export function maybeStoreNewRecentLayout(newPersistedState: PersistedState): void {
  const oldRecentLayouts = getRecentLayouts();
  const newestRecentLayout = recentLayoutFromPersistedState(newPersistedState);
  if (newestRecentLayout == undefined || oldRecentLayouts[0] === newestRecentLayout) {
    return;
  }

  const newRecentLayouts = [
    newestRecentLayout,
    ...oldRecentLayouts.filter((layout) => layout !== newestRecentLayout),
  ].slice(0, LAYOUT_COUNT_STORED);
  storage.setItem(LOCALSTORAGE_KEY, newRecentLayouts);
}

export default function (state: State, action: ActionTypes): State {
  if (panelEditingActions.has(action.type)) {
    maybeStoreNewRecentLayout(state.persistedState);
  }
  return { ...state };
}
