// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useState } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { generateEmptyTypesLib } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/generateTypesLib";
import { ros_lib_dts } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/ros";
import { Diagnostic, UserNodeLog } from "@foxglove/studio-base/players/UserNodePlayer/types";

type UserNodeState = {
  rosLib: string;
  typesLib: string;
  nodeStates: {
    [nodeId: string]: {
      diagnostics: readonly Diagnostic[];
      logs: readonly UserNodeLog[];
    };
  };
};

export const UserNodeStateContext = createContext<
  | {
      state: UserNodeState;
      setUserNodeDiagnostics: (nodeId: string, diagnostics: readonly Diagnostic[]) => void;
      addUserNodeLogs: (nodeId: string, logs: readonly UserNodeLog[]) => void;
      clearUserNodeLogs: (nodeId: string) => void;
      setUserNodeRosLib: (rosLib: string) => void;
      setUserNodeTypesLib: (lib: string) => void;
    }
  | undefined
>(undefined);
UserNodeStateContext.displayName = "UserNodeStateContext";

export function UserNodeStateProvider({ children }: React.PropsWithChildren<unknown>): JSX.Element {
  const [state, setState] = useState<UserNodeState>({
    rosLib: ros_lib_dts,
    typesLib: generateEmptyTypesLib(),
    nodeStates: {},
  });

  const setUserNodeDiagnostics = useCallback(
    (nodeId: string, diagnostics: readonly Diagnostic[]) => {
      setState((prevState) => ({
        ...prevState,
        nodeStates: {
          ...prevState.nodeStates,
          [nodeId]: {
            logs: [],
            ...prevState.nodeStates[nodeId],
            diagnostics, // replace diagnostics
          },
        },
      }));
    },
    [],
  );

  const addUserNodeLogs = useCallback((nodeId: string, logs: readonly UserNodeLog[]) => {
    setState((prevState) => ({
      ...prevState,
      nodeStates: {
        ...prevState.nodeStates,
        [nodeId]: {
          diagnostics: [],
          ...prevState.nodeStates[nodeId],
          logs: (prevState.nodeStates[nodeId]?.logs ?? []).concat(logs), // add logs
        },
      },
    }));
  }, []);

  const clearUserNodeLogs = useCallback((nodeId: string) => {
    setState((prevState) => ({
      ...prevState,
      nodeStates: {
        ...prevState.nodeStates,
        [nodeId]: {
          diagnostics: [],
          ...prevState.nodeStates[nodeId],
          logs: [], // clear logs
        },
      },
    }));
  }, []);

  const setUserNodeRosLib = useCallback((rosLib: string) => {
    setState((prevState) => ({ ...prevState, rosLib }));
  }, []);

  const setUserNodeTypesLib = useCallback((typesLib: string) => {
    setState((prevState) => ({ ...prevState, typesLib }));
  }, []);

  const value = useShallowMemo({
    state,
    setUserNodeDiagnostics,
    addUserNodeLogs,
    clearUserNodeLogs,
    setUserNodeRosLib,
    setUserNodeTypesLib,
  });

  return <UserNodeStateContext.Provider value={value}>{children}</UserNodeStateContext.Provider>;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useUserNodeState() {
  return useGuaranteedContext(UserNodeStateContext, "UserNodeStateContext");
}
