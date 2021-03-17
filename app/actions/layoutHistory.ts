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

export type REDO_LAYOUT_CHANGE = { type: "REDO_LAYOUT_CHANGE"; payload?: never };

export const redoLayoutChange = (): REDO_LAYOUT_CHANGE => ({
  type: "REDO_LAYOUT_CHANGE",
});

export type UNDO_LAYOUT_CHANGE = { type: "UNDO_LAYOUT_CHANGE"; payload?: never };

export const undoLayoutChange = (): UNDO_LAYOUT_CHANGE => ({
  type: "UNDO_LAYOUT_CHANGE",
});

export type LayoutHistoryActions = REDO_LAYOUT_CHANGE | UNDO_LAYOUT_CHANGE;
