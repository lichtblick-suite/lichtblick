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

import type { VariableValue } from "@foxglove/studio";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";

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
