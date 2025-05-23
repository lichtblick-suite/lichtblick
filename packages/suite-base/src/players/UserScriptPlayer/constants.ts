// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// make sure to use import type to avoid bringing in the actual implementations to the bundle
export const DIAGNOSTIC_SEVERITY = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
};

export const SOURCES = {
  Typescript: "Typescript",
  DatatypeExtraction: "DatatypeExtraction",
  InputTopicsChecker: "InputTopicsChecker",
  OutputTopicChecker: "OutputTopicChecker",
  Runtime: "Runtime",
};

export const ERROR_CODES = {
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
