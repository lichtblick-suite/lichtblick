// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@lichtblick/hooks";
import { Immutable } from "@lichtblick/suite";
import { PlayerProblem } from "@lichtblick/suite-base/players/types";

export type SessionProblem = PlayerProblem;

type TaggedProblem = SessionProblem & { tag: string };

export type ProblemsContextStore = Immutable<{
  problems: TaggedProblem[];
  actions: {
    clearProblem: (tag: string) => void;
    setProblem: (tag: string, problem: Immutable<SessionProblem>) => void;
  };
}>;

export const ProblemsContext = createContext<undefined | StoreApi<ProblemsContextStore>>(undefined);

ProblemsContext.displayName = "ProblemsContext";

/**
 * Fetches values from the problems store.
 */
export function useProblemsStore<T>(selector: (store: ProblemsContextStore) => T): T {
  const context = useGuaranteedContext(ProblemsContext);
  return useStore(context, selector);
}

const selectActions = (store: ProblemsContextStore) => store.actions;

/**
 * Convenience hook for accessing problems store actions.
 */
export function useProblemsActions(): ProblemsContextStore["actions"] {
  return useProblemsStore(selectActions);
}
