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

import { HoverValue } from "@foxglove/studio-base/types/hoverValue";

export type SET_HOVER_VALUE = {
  type: "SET_HOVER_VALUE";
  payload: {
    value: HoverValue;
    skipSettingLocalStorage: true;
  };
};

export type CLEAR_HOVER_VALUE = {
  type: "CLEAR_HOVER_VALUE";
  payload: {
    componentId: string;
    skipSettingLocalStorage: true;
  };
};

export const setHoverValue = (payload: HoverValue): SET_HOVER_VALUE => ({
  type: "SET_HOVER_VALUE",
  payload: { value: payload, skipSettingLocalStorage: true },
});

export const clearHoverValue = (payload: { componentId: string }): CLEAR_HOVER_VALUE => ({
  type: "CLEAR_HOVER_VALUE",
  payload: { ...payload, skipSettingLocalStorage: true },
});

export type HoverValueActions = SET_HOVER_VALUE | CLEAR_HOVER_VALUE;
