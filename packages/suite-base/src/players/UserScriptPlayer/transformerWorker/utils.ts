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

import ts from "typescript/lib/typescript";

import { DIAGNOSTIC_SEVERITY } from "@lichtblick/suite-base/players/UserScriptPlayer/constants";
import { Diagnostic } from "@lichtblick/suite-base/players/UserScriptPlayer/types";

const mapCategoryToDiagnosticSeverity = (
  category: ts.DiagnosticCategory,
): (typeof DIAGNOSTIC_SEVERITY)[keyof typeof DIAGNOSTIC_SEVERITY] => {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return DIAGNOSTIC_SEVERITY.Error;
    case ts.DiagnosticCategory.Warning:
      return DIAGNOSTIC_SEVERITY.Warning;
    case ts.DiagnosticCategory.Message:
      return DIAGNOSTIC_SEVERITY.Info;
    case ts.DiagnosticCategory.Suggestion:
      return DIAGNOSTIC_SEVERITY.Hint;
    default:
      throw new Error("Diagnostic category not recognized");
  }
};

// Function responsible for transforming diagnostic information into a format
// the monaco-editor can use.
export const transformDiagnosticToMarkerData = (diagnostic: ts.Diagnostic): Diagnostic => {
  if (!diagnostic.file || diagnostic.start == undefined || diagnostic.length == undefined) {
    throw new Error("Invariant: diagnostic is not initialized");
  }

  const { line: startLineNumber, character: startColumn } =
    diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

  const { line: endLineNumber, character: endColumn } =
    diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start + diagnostic.length);

  return {
    message: flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    severity: mapCategoryToDiagnosticSeverity(diagnostic.category),
    source: "Typescript",
    startLineNumber,
    startColumn,
    endLineNumber,
    endColumn,
    code: diagnostic.code,
  };
};

// Flatten list of formatted diagnostic messages
// https://github.com/microsoft/monaco-typescript/blob/126dbe1f6f4b235bac436d580b83696070271f71/src/languageFeatures.ts#L36
function flattenDiagnosticMessageText(
  diag: string | ts.DiagnosticMessageChain | undefined,
  newLine: string,
  indent = 0,
): string {
  if (typeof diag === "string") {
    return diag;
  } else if (diag == undefined) {
    return "";
  }
  let result = "";
  if (indent > 0) {
    result += newLine;

    for (let i = 0; i < indent; i++) {
      result += "  ";
    }
  }
  result += diag.messageText;
  if (diag.next) {
    for (const kid of diag.next) {
      result += flattenDiagnosticMessageText(kid, newLine, indent + 1);
    }
  }
  return result;
}

// https://www.typescriptlang.org/docs/handbook/compiler-options.html
export const baseCompilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
};
