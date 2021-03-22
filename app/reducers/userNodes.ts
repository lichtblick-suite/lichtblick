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

import { ActionTypes } from "@foxglove-studio/app/actions";
import { Diagnostic, UserNodeLog } from "@foxglove-studio/app/players/UserNodePlayer/types";
import { State } from "@foxglove-studio/app/reducers";

export type UserNodeDiagnostics = {
  diagnostics: Diagnostic[];
  logs: UserNodeLog[];
};

export default function userNodes(state: State, action: ActionTypes): State {
  switch (action.type) {
    case "SET_USER_NODE_DIAGNOSTICS": {
      const userNodeDiagnostics = { ...state.userNodes.userNodeDiagnostics } as any;
      Object.keys(action.payload.diagnostics).forEach((nodeId) => {
        const payloadDiagnostics = action.payload.diagnostics[nodeId]?.diagnostics;
        if (action.payload.diagnostics[nodeId] === undefined) {
          delete userNodeDiagnostics[nodeId];
        } else if (!userNodeDiagnostics[nodeId]) {
          userNodeDiagnostics[nodeId] = { diagnostics: payloadDiagnostics, logs: [] };
        } else {
          userNodeDiagnostics[nodeId] = {
            ...userNodeDiagnostics[nodeId],
            diagnostics: payloadDiagnostics,
          };
        }
      });
      return { ...state, userNodes: { ...state.userNodes, userNodeDiagnostics } };
    }

    case "ADD_USER_NODE_LOGS": {
      const userNodeDiagnostics = { ...state.userNodes.userNodeDiagnostics };
      for (const nodeId of Object.keys(action.payload)) {
        const existingLogs = (userNodeDiagnostics as any)[nodeId]?.logs;
        const payloadLogs = action.payload[nodeId]?.logs;
        if (action.payload[nodeId] === undefined) {
          delete (userNodeDiagnostics as any)[nodeId];
        } else if (!(userNodeDiagnostics as any)[nodeId]) {
          (userNodeDiagnostics as any)[nodeId] = { diagnostics: [], logs: payloadLogs };
        } else {
          (userNodeDiagnostics as any)[nodeId] = {
            ...(userNodeDiagnostics as any)[nodeId],
            logs: existingLogs.concat(payloadLogs),
          };
        }
      }
      return { ...state, userNodes: { ...state.userNodes, userNodeDiagnostics } };
    }

    case "CLEAR_USER_NODE_LOGS": {
      const userNodeDiagnostics = { ...state.userNodes.userNodeDiagnostics };
      const nodeId = action.payload;
      if ((userNodeDiagnostics as any)[nodeId]) {
        (userNodeDiagnostics as any)[nodeId] = {
          ...(userNodeDiagnostics as any)[nodeId],
          logs: [],
        };
      }
      return { ...state, userNodes: { ...state.userNodes, userNodeDiagnostics } };
    }

    case "SET_USER_NODE_ROS_LIB": {
      return { ...state, userNodes: { ...state.userNodes, rosLib: action.payload } };
    }

    default:
      return { ...state, userNodes: state.userNodes };
  }
}
