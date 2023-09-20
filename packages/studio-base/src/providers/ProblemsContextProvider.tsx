// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { ReactNode, useState } from "react";
import { StoreApi, create } from "zustand";

import {
  ProblemsContext,
  ProblemsContextStore,
  SessionProblem,
} from "@foxglove/studio-base/context/ProblemsContext";

function createProblemsStore(): StoreApi<ProblemsContextStore> {
  return create<ProblemsContextStore>((set, get) => {
    return {
      problems: [],
      actions: {
        clearProblem: (tag: string) => {
          set({
            problems: get().problems.filter((prob) => prob.tag !== tag),
          });
        },
        setProblem: (tag: string, problem: Immutable<SessionProblem>) => {
          const newProblems = get().problems.filter((prob) => prob.tag !== tag);

          set({
            problems: [{ tag, ...problem }, ...newProblems],
          });
        },
      },
    };
  });
}

export default function ProblemsContextProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [store] = useState(createProblemsStore);
  return <ProblemsContext.Provider value={store}>{children}</ProblemsContext.Provider>;
}
