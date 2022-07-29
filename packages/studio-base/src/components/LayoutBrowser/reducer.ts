// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compact, pull, union, xor } from "lodash";
import { Dispatch } from "react";
import { useImmerReducer } from "use-immer";

import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

type MultiAction = "delete";

type State = {
  busy: boolean;
  error: undefined | Error;
  online: boolean;
  lastSelectedId: undefined | string;
  multiAction: undefined | { action: MultiAction; ids: string[] };
  selectedIds: string[];
};

type Action =
  | { type: "clear-multi-action" }
  | { type: "queue-multi-action"; action: MultiAction }
  | {
      type: "select-id";
      id?: string;
      layouts?: undefined | { personal: Layout[]; shared: Layout[] };
      shiftKey?: boolean;
      modKey?: boolean;
    }
  | { type: "set-busy"; value: boolean }
  | { type: "set-error"; value: undefined | Error }
  | { type: "set-online"; value: boolean }
  | { type: "shift-multi-action" };

function reducer(draft: State, action: Action) {
  switch (action.type) {
    case "clear-multi-action":
      draft.multiAction = undefined;
      break;
    case "queue-multi-action":
      draft.multiAction = { action: action.action, ids: draft.selectedIds };
      break;
    case "select-id":
      if (action.modKey === true) {
        draft.selectedIds = xor(draft.selectedIds, compact([action.id]));
      } else if (action.shiftKey === true) {
        for (const layouts of Object.values(action.layouts ?? {})) {
          const lastId = layouts.findIndex((layout) => layout.id === draft.lastSelectedId);
          const thisId = layouts.findIndex((layout) => layout.id === action.id);
          if (lastId !== -1 && thisId !== -1) {
            const start = Math.min(lastId, thisId);
            const end = Math.max(lastId, thisId);
            for (let i = start; i <= end; i++) {
              draft.selectedIds = union(draft.selectedIds, [layouts[i]!.id]);
            }
          }
        }
      } else {
        draft.multiAction = undefined;
        draft.selectedIds = compact([action.id]);
      }
      draft.lastSelectedId = action.id;
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
  }
}

export function useLayoutBrowserReducer(
  props: Pick<State, "busy" | "error" | "online">,
): [State, Dispatch<Action>] {
  return useImmerReducer(reducer, {
    ...props,
    lastSelectedId: undefined,
    selectedIds: [],
    multiAction: undefined,
  });
}
