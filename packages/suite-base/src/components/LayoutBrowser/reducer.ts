// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

    case "select-id": {
      const { id, modKey, shiftKey } = action;

      if (modKey === true) {
        // Toggle selection (Ctrl / Cmd)
        draft.selectedIds = _.xor(draft.selectedIds, _.compact([id]));
      } else if (shiftKey === true) {
        // explicitly disable multi selection with shift key
        draft.multiAction = undefined;
      } else {
        // Normal click → single select
        draft.multiAction = undefined;
        draft.selectedIds = _.compact([id]);
      }

      draft.lastSelectedId = id;
      break;
    }

    case "set-busy":
      draft.busy = action.value;
      break;

    case "set-error":
      draft.error = action.value;
      break;

    case "set-online":
      draft.online = action.value;
      break;
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
