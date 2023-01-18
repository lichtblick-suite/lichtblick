// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import type { SourceFile, TypeChecker } from "typescript";

import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Topic, MessageEvent } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

// make sure to use import type to avoid bringing in the actual implementations to the bundle

export const DiagnosticSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
};

export const Sources = {
  Typescript: "Typescript",
  DatatypeExtraction: "DatatypeExtraction",
  InputTopicsChecker: "InputTopicsChecker",
  OutputTopicChecker: "OutputTopicChecker",
  Runtime: "Runtime",
};

export const ErrorCodes = {
  RUNTIME: 1,
  DatatypeExtraction: {
    NO_DEFAULT_EXPORT: 1,
    NON_FUNC_DEFAULT_EXPORT: 2,
    NO_TYPE_RETURN: 3,
    BAD_TYPE_RETURN: 4,
    UNKNOWN_ERROR: 5,
    NO_UNIONS: 6,
    NO_FUNCTIONS: 7,
    NO_CLASSES: 8,
    NO_TYPE_LITERALS: 9,
    NO_TUPLES: 10,
    NO_INTERSECTION_TYPES: 11,
    NO_TYPEOF: 12,
    PREFER_ARRAY_LITERALS: 13,
    STRICT_MARKERS_RETURN_TYPE: 14,
    LIMITED_UNIONS: 15,
    NO_NESTED_ANY: 16,
    NO_MAPPED_TYPES: 17,
    INVALID_PROPERTY: 18,
    INVALID_INDEXED_ACCESS: 19,
  },
  InputTopicsChecker: {
    NO_TOPIC_AVAIL: 1,
    NO_INPUTS_EXPORT: 2,
    EMPTY_INPUTS_EXPORT: 3,
    BAD_INPUTS_TYPE: 4,
  },
  OutputTopicChecker: {
    NO_OUTPUTS: 1,
    NOT_UNIQUE: 2,
    EXISTING_TOPIC: 3,
  },
};

export type Diagnostic = {
  severity: (typeof DiagnosticSeverity)[keyof typeof DiagnosticSeverity];
  message: string;
  source: (typeof Sources)[keyof typeof Sources];
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
  code: number;
};

export type NodeData = {
  name: string;
  sourceCode: string;
  transpiledCode: string;
  projectCode: Map<string, string> | undefined;
  diagnostics: readonly Diagnostic[];
  inputTopics: readonly string[];
  outputTopic: string;
  outputDatatype: string;
  datatypes: RosDatatypes;
  sourceFile?: SourceFile;
  typeChecker?: TypeChecker;
  rosLib: string;
  typesLib: string;
  // An array of globalVariable names
  globalVariables: readonly string[];
};

export type NodeRegistration = {
  nodeId: string;
  nodeData: NodeData;
  inputs: readonly string[];
  output: Topic;
  processBlockMessage: (
    messageEvent: MessageEvent<unknown>,
    globalVariables: GlobalVariables,
  ) => Promise<MessageEvent<unknown> | undefined>;
  processMessage: (
    messageEvent: MessageEvent<unknown>,
    globalVariables: GlobalVariables,
  ) => Promise<MessageEvent<unknown> | undefined>;
  terminate: () => void;
};

export type NodeDataTransformer = (nodeData: NodeData, topics: Topic[]) => NodeData;

export type UserNodeLog = {
  source: "registerNode" | "processMessage";
  value: unknown;
};

export type RegistrationOutput = {
  error?: string;
  userNodeLogs: UserNodeLog[];
  userNodeDiagnostics: Diagnostic[];
};

export type ProcessMessageOutput = {
  message: Record<string, unknown> | undefined;
  error?: string;
  userNodeLogs: UserNodeLog[];
  userNodeDiagnostics: Diagnostic[];
};
