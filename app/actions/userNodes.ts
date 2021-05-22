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

import {
  UserNodeDiagnostics,
  UserNodeLogs,
} from "@foxglove/studio-base/players/UserNodePlayer/types";

type SET_USER_NODE_DIAGNOSTICS = {
  type: "SET_USER_NODE_DIAGNOSTICS";
  payload: { diagnostics: UserNodeDiagnostics };
};

type ADD_USER_NODE_LOGS = {
  type: "ADD_USER_NODE_LOGS";
  payload: UserNodeLogs;
};

type CLEAR_USER_NODE_LOGS = {
  type: "CLEAR_USER_NODE_LOGS";
  payload: string;
};

type SET_USER_NODE_ROS_LIB = {
  type: "SET_USER_NODE_ROS_LIB";
  payload: string;
};

export const setUserNodeDiagnostics = (
  diagnostics: UserNodeDiagnostics,
): SET_USER_NODE_DIAGNOSTICS => ({
  type: "SET_USER_NODE_DIAGNOSTICS",
  payload: { diagnostics },
});

export const addUserNodeLogs = (payload: UserNodeLogs): ADD_USER_NODE_LOGS => ({
  type: "ADD_USER_NODE_LOGS",
  payload,
});

export const clearUserNodeLogs = (payload: string): CLEAR_USER_NODE_LOGS => ({
  type: "CLEAR_USER_NODE_LOGS",
  payload,
});

export const setUserNodeRosLib = (payload: string): SET_USER_NODE_ROS_LIB => ({
  type: "SET_USER_NODE_ROS_LIB",
  payload,
});

export type AddUserNodeLogs = typeof addUserNodeLogs;
export type ClearUserNodeLogs = typeof clearUserNodeLogs;
export type SetUserNodeDiagnostics = typeof setUserNodeDiagnostics;
export type SetUserNodeRosLib = typeof setUserNodeRosLib;

export type UserNodesActions =
  | ADD_USER_NODE_LOGS
  | CLEAR_USER_NODE_LOGS
  | SET_USER_NODE_DIAGNOSTICS
  | SET_USER_NODE_ROS_LIB;
