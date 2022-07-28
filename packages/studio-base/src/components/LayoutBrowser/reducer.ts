// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compact, pull, xor } from "lodash";
import { Dispatch } from "react";
import { useImmerReducer } from "use-immer";

type MultiAction = "delete";

type State = {
  busy: boolean;
  error: undefined | Error;
  online: boolean;
  multiAction: undefined | { action: MultiAction; ids: string[] };
  selectedIds: string[];
};

type Action =
  | { type: "clear-multi-action" }
  | { type: "queue-multi-action"; action: MultiAction }
  | { type: "set-busy"; value: boolean }
  | { type: "set-error"; value: undefined | Error }
  | { type: "set-online"; value: boolean }
  | { type: "select-id"; id?: string }
  | { type: "shift-multi-action" }
  | { type: "toggle-selected"; id: string };

function reducer(draft: State, action: Action) {
  switch (action.type) {
    case "clear-multi-action":
      draft.multiAction = undefined;
      break;
    case "queue-multi-action":
      draft.multiAction = { action: action.action, ids: draft.selectedIds };
      break;
    case "select-id":
      draft.multiAction = undefined;
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
    case "shift-multi-action": {
      const id = draft.multiAction?.ids.shift();
      if (draft.multiAction?.ids.length === 0) {
        draft.multiAction = undefined;
      }
      pull(draft.selectedIds, id);
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
  return useImmerReducer(reducer, { ...props, selectedIds: [], multiAction: undefined });
}
