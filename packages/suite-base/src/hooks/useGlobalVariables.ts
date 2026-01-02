// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import type { VariableValue } from "@lichtblick/suite";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";

export type GlobalVariables = { [key: string]: VariableValue };

export const EMPTY_GLOBAL_VARIABLES: GlobalVariables = Object.freeze({});

const globalVariablesSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.globalVariables ?? EMPTY_GLOBAL_VARIABLES;

export default function useGlobalVariables(): {
  globalVariables: GlobalVariables;
  setGlobalVariables: (arg0: GlobalVariables) => void;
  overwriteGlobalVariables: (arg0: GlobalVariables) => void;
} {
  const { setGlobalVariables, overwriteGlobalVariables } = useCurrentLayoutActions();
  const globalVariables = useCurrentLayoutSelector(globalVariablesSelector);
  return { setGlobalVariables, overwriteGlobalVariables, globalVariables };
}
