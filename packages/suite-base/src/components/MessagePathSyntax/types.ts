// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { TextFieldProps } from "@mui/material";
import { CSSProperties } from "react";

import {
  MessagePathPart,
  MessagePathStructureItem,
  MessagePathStructureItemMessage,
} from "@lichtblick/message-path/src/types";
import { Topic } from "@lichtblick/suite-base/players/types";

export type MessagePathsForStructureArgs = {
  validTypes?: readonly string[];
  noMultiSlices?: boolean;
  messagePath?: MessagePathPart[];
};

export type MessagePathsForStructure = {
  path: string;
  terminatingStructureItem: MessagePathStructureItem;
}[];

export type MessagePathInputBaseProps = {
  supportsMathModifiers?: boolean;
  path: string; // A path of the form `/topic.some_field[:]{id==42}.x`
  index?: number; // Optional index field which gets passed to `onChange` (so you don't have to create anonymous functions)
  onChange: (value: string, index?: number) => void;
  validTypes?: readonly string[]; // Valid types, like "message", "array", or "primitive", or a ROS primitive like "float64"
  noMultiSlices?: boolean; // Don't suggest slices with multiple values `[:]`, only single values like `[0]`.
  placeholder?: string;
  inputStyle?: CSSProperties;
  disabled?: boolean;
  disableAutocomplete?: boolean; // Treat this as a normal input, with no autocomplete.
  readOnly?: boolean;
  prioritizedDatatype?: string;
  variant?: TextFieldProps["variant"];
};

export type StructureTraversalResult = {
  valid: boolean;
  msgPathPart?: MessagePathPart;
  structureItem?: MessagePathStructureItem;
};

export type StructureAllItemsByPathProps = {
  noMultiSlices?: boolean;
  validTypes?: readonly string[];
  messagePathStructuresForDataype: Record<string, MessagePathStructureItemMessage>;
  topics: readonly Topic[];
};
