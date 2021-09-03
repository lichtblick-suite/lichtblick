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

import { useMemo } from "react";

import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";

export type LinkedGlobalVariable = {
  topic: string;
  markerKeyPath: string[];
  name: string;
};

export type LinkedGlobalVariables = readonly LinkedGlobalVariable[];

const EMPTY_VARIABLES = Object.freeze([]);

export default function useLinkedGlobalVariables(): {
  linkedGlobalVariables: LinkedGlobalVariables;
  setLinkedGlobalVariables: (arg0: LinkedGlobalVariables) => void;
  linkedGlobalVariablesByName: { [name: string]: LinkedGlobalVariable[] };
} {
  const { setLinkedGlobalVariables } = useCurrentLayoutActions();
  const linkedGlobalVariables = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data?.linkedGlobalVariables ?? EMPTY_VARIABLES,
  );
  const linkedGlobalVariablesByName = useMemo(() => {
    const linksByName: { [name: string]: LinkedGlobalVariable[] } = {};
    for (const link of linkedGlobalVariables) {
      (linksByName[link.name] ??= []).push(link);
    }
    return linksByName;
  }, [linkedGlobalVariables]);
  return {
    linkedGlobalVariables,
    linkedGlobalVariablesByName,
    setLinkedGlobalVariables,
  };
}
