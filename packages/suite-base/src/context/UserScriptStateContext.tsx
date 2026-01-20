// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useState } from "react";
import { StoreApi, createStore, useStore } from "zustand";

import { useGuaranteedContext } from "@lichtblick/hooks";

// Lazy import to avoid bundling TypeScript in production
let generateEmptyTypesLib: (() => string) | undefined;
let ros_lib_dts: string | undefined;

// Initialize with empty values - will be populated when UserScript features are enabled
const EMPTY_ROS_LIB = "// UserScript features disabled";
const EMPTY_TYPES_LIB = "// UserScript features disabled";

// Re-export types for compatibility
export type Diagnostic = {
  severity: number;
  message: string;
  source: string;
  code: number;
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
};

export type UserScriptLog = {
  source: string;
  value: unknown;
};

// Flag to check if UserScript features are enabled
let userScriptFeaturesEnabled = false;

// Function to enable UserScript features (loads TypeScript dependencies)
export async function enableUserScriptFeatures(): Promise<void> {
  if (userScriptFeaturesEnabled) {
    return;
  }

  try {
    const [generateTypesLibModule, rosLibModule] = await Promise.all([
      import("@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/generateTypesLib"),
      import("@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/ros"),
    ]);

    generateEmptyTypesLib = generateTypesLibModule.generateEmptyTypesLib;
    ros_lib_dts = rosLibModule.ros_lib_dts;
    userScriptFeaturesEnabled = true;
  } catch (error) {
    console.warn("Failed to load UserScript features:", error);
  }
}

type UserScriptState = {
  rosLib: string;
  typesLib: string;
  scriptStates: {
    [scriptId: string]: {
      diagnostics: readonly Diagnostic[];
      logs: readonly UserScriptLog[];
    };
  };
};

export type UserScriptStore = {
  state: UserScriptState;
  actions: {
    setUserScriptDiagnostics: (scriptId: string, diagnostics: readonly Diagnostic[]) => void;
    addUserScriptLogs: (scriptId: string, logs: readonly UserScriptLog[]) => void;
    clearUserScriptLogs: (scriptId: string) => void;
    setUserScriptRosLib: (rosLib: string) => void;
    setUserScriptTypesLib: (lib: string) => void;
  };
};

const UserScriptStateContext = createContext<StoreApi<UserScriptStore> | undefined>(undefined);
UserScriptStateContext.displayName = "UserScriptStateContext";

function create() {
  return createStore<UserScriptStore>((set) => {
    return {
      state: {
        rosLib: ros_lib_dts ?? EMPTY_ROS_LIB,
        typesLib: generateEmptyTypesLib?.() ?? EMPTY_TYPES_LIB,
        scriptStates: {},
      },
      actions: {
        setUserScriptDiagnostics: (scriptId: string, diagnostics: readonly Diagnostic[]) => {
          set((prevState) => ({
            state: {
              ...prevState.state,
              scriptStates: {
                ...prevState.state.scriptStates,
                [scriptId]: {
                  logs: [],
                  ...prevState.state.scriptStates[scriptId],
                  diagnostics, // replace diagnostics
                },
              },
            },
          }));
        },
        addUserScriptLogs(scriptId: string, logs: readonly UserScriptLog[]) {
          set((prevState) => ({
            state: {
              ...prevState.state,
              scriptStates: {
                ...prevState.state.scriptStates,
                [scriptId]: {
                  diagnostics: [],
                  ...prevState.state.scriptStates[scriptId],
                  logs: (prevState.state.scriptStates[scriptId]?.logs ?? []).concat(logs), // add logs
                },
              },
            },
          }));
        },
        clearUserScriptLogs(scriptId: string) {
          set((prevState) => ({
            state: {
              ...prevState.state,
              scriptStates: {
                ...prevState.state.scriptStates,
                [scriptId]: {
                  diagnostics: [],
                  ...prevState.state.scriptStates[scriptId],
                  logs: [], // clear logs
                },
              },
            },
          }));
        },
        setUserScriptRosLib(rosLib: string) {
          set((prevState) => ({ state: { ...prevState.state, rosLib } }));
        },
        setUserScriptTypesLib(typesLib: string) {
          set((prevState) => ({ state: { ...prevState.state, typesLib } }));
        },
      },
    };
  });
}

export function UserScriptStateProvider({ children }: React.PropsWithChildren): React.JSX.Element {
  const [value] = useState(() => create());

  return (
    <UserScriptStateContext.Provider value={value}>{children}</UserScriptStateContext.Provider>
  );
}

export function useUserScriptState<T>(selector: (arg: UserScriptStore) => T): T {
  const store = useGuaranteedContext(UserScriptStateContext, "UserScriptStateContext");
  return useStore(store, selector);
}
