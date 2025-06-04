// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
import {
  DIAGNOSTIC_SEVERITY,
  SOURCES,
  ERROR_CODES,
} from "@lichtblick/suite-base/players/UserScriptPlayer/constants";

export const noFuncError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "No 'default export' function found.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_DEFAULT_EXPORT,
};

export const nonFuncError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "The 'default export' must be assigned to a function.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NON_FUNC_DEFAULT_EXPORT,
};

export const badTypeReturnError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "The 'default export' function must return an object type with at least one property.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.BAD_TYPE_RETURN,
};

export const limitedUnionsError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message:
    "The 'default export' function can only return union types of the form: 'YourType | undefined'.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.LIMITED_UNIONS,
};

export const unionsError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Unions are not allowed in return type.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_UNIONS,
};

export const functionError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Functions are not allowed as or in the return type.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_FUNCTIONS,
};

export const noTypeLiteralsError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Type literals are not allowed as or in the return type.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_TYPE_LITERALS,
};

export const noIntersectionTypesError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Type intersections are not allowed as or in the return type.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_INTERSECTION_TYPES,
};

export const preferArrayLiteral = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Please use array literal syntax (e.g. 'number[]') instead of the 'Array<number>'.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.PREFER_ARRAY_LITERALS,
};

export const classError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Classes are not allowed as or in the return type.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_CLASSES,
};

export const noTypeOfError = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "'typeof' cannot be used as or in the return type",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_TYPEOF,
};

export const noTuples = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Tuples are not allowed as types.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_TUPLES,
};

export const noNestedAny = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "Cannot nest 'any' in the return type.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_NESTED_ANY,
};

export const noMappedTypes = {
  severity: DIAGNOSTIC_SEVERITY.Error,
  message: "MappedTypes such as Record<Keys,Type> are not supported.",
  source: SOURCES.DatatypeExtraction,
  code: ERROR_CODES.DatatypeExtraction.NO_MAPPED_TYPES,
};
