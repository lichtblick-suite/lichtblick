// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compact, pull, xor } from "lodash";
import { Dispatch } from "react";
import { useImmerReducer } from "use-immer";

type State = {
  busy: boolean;
  error: undefined | Error;
  online: boolean;
  selectedIds: string[];
  queuedDeleteIds: string[];
};

type Action =
  | { type: "clear-queued-deletes" }
  | { type: "queue-deletes" }
  | { type: "set-busy"; value: boolean }
  | { type: "set-error"; value: undefined | Error }
  | { type: "set-online"; value: boolean }
  | { type: "select-id"; id?: string }
  | { type: "shift-queued-deletes" }
  | { type: "toggle-selected"; id: string };

function reducer(draft: State, action: Action) {
  switch (action.type) {
    case "clear-queued-deletes":
      draft.queuedDeleteIds = [];
      break;
    case "queue-deletes":
      draft.queuedDeleteIds = draft.selectedIds;
      break;
    case "select-id":
      draft.queuedDeleteIds = [];
      draft.selectedIds = compact([action.id]);
      break;
    case "set-busy":
      draft.busy = action.value;
      break;
    case "set-error":
      draft.error = action.value;
      break;
    case "set-online":
      draft.online = action.value;
      break;
    case "shift-queued-deletes": {
      const toDelete = draft.queuedDeleteIds.shift();
      pull(draft.selectedIds, toDelete);
      break;
    }
    case "toggle-selected":
      draft.selectedIds = xor(draft.selectedIds, [action.id]);
      break;
  }
}

export function useLayoutBrowserReducer(
  props: Pick<State, "busy" | "error" | "online">,
): [State, Dispatch<Action>] {
  return useImmerReducer(reducer, { ...props, selectedIds: [], queuedDeleteIds: [] });
}
