// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { Dispatch } from "react";
import { useImmerReducer } from "use-immer";

import {
  LayoutSelectionState,
  LayoutSelectionAction,
} from "@lichtblick/suite-base/components/LayoutBrowser/types";

function reducer(draft: LayoutSelectionState, action: LayoutSelectionAction) {
  switch (action.type) {
    case "clear-multi-action":
      draft.multiAction = undefined;
      break;
    case "queue-multi-action":
      draft.multiAction = { action: action.action, ids: draft.selectedIds };
      break;
    case "select-id":
      if (action.modKey === true) {
        draft.selectedIds = _.xor(draft.selectedIds, _.compact([action.id]));
      } else if (action.shiftKey === true) {
        for (const layouts of Object.values(action.layouts ?? {})) {
          const lastId = layouts.findIndex((layout) => layout.id === draft.lastSelectedId);
          const thisId = layouts.findIndex((layout) => layout.id === action.id);
          if (lastId !== -1 && thisId !== -1) {
            const start = Math.min(lastId, thisId);
            const end = Math.max(lastId, thisId);
            for (let i = start; i <= end; i++) {
              draft.selectedIds = _.union(draft.selectedIds, [layouts[i]!.id]);
            }
          }
        }
      } else {
        draft.multiAction = undefined;
        draft.selectedIds = _.compact([action.id]);
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
      _.pull(draft.selectedIds, id);
      break;
    }
  }
}

export function useLayoutBrowserReducer(
  props: Pick<LayoutSelectionState, "busy" | "error" | "online" | "lastSelectedId">,
): [LayoutSelectionState, Dispatch<LayoutSelectionAction>] {
  return useImmerReducer(reducer, {
    ...props,
    selectedIds: [],
    multiAction: undefined,
  });
}
