// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { GlobalVariables } from "@lichtblick/suite-base/hooks/useGlobalVariables";
import { MessageEvent, Topic } from "@lichtblick/suite-base/players/types";
import { RosDatatypes } from "@lichtblick/suite-base/types/RosDatatypes";

import { DIAGNOSTIC_SEVERITY, SOURCES } from "./constants";

export type Diagnostic = {
  severity: (typeof DIAGNOSTIC_SEVERITY)[keyof typeof DIAGNOSTIC_SEVERITY];
  message: string;
  source: (typeof SOURCES)[keyof typeof SOURCES];
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
