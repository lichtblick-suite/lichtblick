// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathPart, MessagePathStructureItem } from "@lichtblick/message-path/src/types";

export type MessagePathsForStructureArgs = {
  validTypes?: readonly string[];
  noMultiSlices?: boolean;
  messagePath?: MessagePathPart[];
};

export type MessagePathsForStructure = {
  path: string;
  terminatingStructureItem: MessagePathStructureItem;
}[];
