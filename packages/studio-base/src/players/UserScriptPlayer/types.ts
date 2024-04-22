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

const DiagnosticSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
};

const Sources = {
  Typescript: "Typescript",
  DatatypeExtraction: "DatatypeExtraction",
  InputTopicsChecker: "InputTopicsChecker",
  OutputTopicChecker: "OutputTopicChecker",
  Runtime: "Runtime",
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

export type ScriptData = {
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

export type ScriptRegistration = {
  scriptId: string;
  scriptData: ScriptData;
  inputs: readonly string[];
  output: Topic;
  processBlockMessage: (
    messageEvent: MessageEvent,
    globalVariables: GlobalVariables,
  ) => Promise<MessageEvent | undefined>;
  processMessage: (
    messageEvent: MessageEvent,
    globalVariables: GlobalVariables,
  ) => Promise<MessageEvent | undefined>;
  terminate: () => void;
};

export type ScriptDataTransformer = (scriptData: ScriptData, topics: Topic[]) => ScriptData;

export type UserScriptLog = {
  source: "registerScript" | "processMessage";
  value: unknown;
};

export type RegistrationOutput = {
  error?: string;
  userScriptLogs: UserScriptLog[];
  userScriptDiagnostics: Diagnostic[];
};

export type ProcessMessageOutput = {
  message: Record<string, unknown> | undefined;
  error?: string;
  userScriptLogs: UserScriptLog[];
  userScriptDiagnostics: Diagnostic[];
};
