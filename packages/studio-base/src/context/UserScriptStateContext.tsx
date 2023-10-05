// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useState } from "react";

import { useShallowMemo, useGuaranteedContext } from "@foxglove/hooks";
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

const UserScriptStateContext = createContext<
  | {
      state: UserScriptState;
      setUserScriptDiagnostics: (scriptId: string, diagnostics: readonly Diagnostic[]) => void;
      addUserScriptLogs: (scriptId: string, logs: readonly UserScriptLog[]) => void;
      clearUserScriptLogs: (scriptId: string) => void;
      setUserScriptRosLib: (rosLib: string) => void;
      setUserScriptTypesLib: (lib: string) => void;
    }
  | undefined
>(undefined);
UserScriptStateContext.displayName = "UserScriptStateContext";

export function UserScriptStateProvider({ children }: React.PropsWithChildren): JSX.Element {
  const [state, setState] = useState<UserScriptState>({
    rosLib: ros_lib_dts,
    typesLib: generateEmptyTypesLib(),
    scriptStates: {},
  });

  const setUserScriptDiagnostics = useCallback(
    (scriptId: string, diagnostics: readonly Diagnostic[]) => {
      setState((prevState) => ({
        ...prevState,
        scriptStates: {
          ...prevState.scriptStates,
          [scriptId]: {
            logs: [],
            ...prevState.scriptStates[scriptId],
            diagnostics, // replace diagnostics
          },
        },
      }));
    },
    [],
  );

  const addUserScriptLogs = useCallback((scriptId: string, logs: readonly UserScriptLog[]) => {
    setState((prevState) => ({
      ...prevState,
      scriptStates: {
        ...prevState.scriptStates,
        [scriptId]: {
          diagnostics: [],
          ...prevState.scriptStates[scriptId],
          logs: (prevState.scriptStates[scriptId]?.logs ?? []).concat(logs), // add logs
        },
      },
    }));
  }, []);

  const clearUserScriptLogs = useCallback((scriptId: string) => {
    setState((prevState) => ({
      ...prevState,
      scriptStates: {
        ...prevState.scriptStates,
        [scriptId]: {
          diagnostics: [],
          ...prevState.scriptStates[scriptId],
          logs: [], // clear logs
        },
      },
    }));
  }, []);

  const setUserScriptRosLib = useCallback((rosLib: string) => {
    setState((prevState) => ({ ...prevState, rosLib }));
  }, []);

  const setUserScriptTypesLib = useCallback((typesLib: string) => {
    setState((prevState) => ({ ...prevState, typesLib }));
  }, []);

  const value = useShallowMemo({
    state,
    setUserScriptDiagnostics,
    addUserScriptLogs,
    clearUserScriptLogs,
    setUserScriptRosLib,
    setUserScriptTypesLib,
  });

  return (
    <UserScriptStateContext.Provider value={value}>{children}</UserScriptStateContext.Provider>
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useUserScriptState() {
  return useGuaranteedContext(UserScriptStateContext, "UserScriptStateContext");
}
