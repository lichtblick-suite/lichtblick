// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useState } from "react";
import { StoreApi, createStore, useStore } from "zustand";

import { useGuaranteedContext } from "@foxglove/hooks";
import { generateEmptyTypesLib } from "@foxglove/studio-base/players/UserScriptPlayer/transformerWorker/generateTypesLib";
import { ros_lib_dts } from "@foxglove/studio-base/players/UserScriptPlayer/transformerWorker/typescript/ros";
import { Diagnostic, UserScriptLog } from "@foxglove/studio-base/players/UserScriptPlayer/types";

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
        rosLib: ros_lib_dts,
        typesLib: generateEmptyTypesLib(),
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

export function UserScriptStateProvider({ children }: React.PropsWithChildren): JSX.Element {
  const [value] = useState(() => create());

  return (
    <UserScriptStateContext.Provider value={value}>{children}</UserScriptStateContext.Provider>
  );
}

export function useUserScriptState<T>(selector: (arg: UserScriptStore) => T): T {
  const store = useGuaranteedContext(UserScriptStateContext, "UserScriptStateContext");
  return useStore(store, selector);
}
