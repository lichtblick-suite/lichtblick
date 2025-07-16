// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathStructureItem } from "@lichtblick/message-path/src/types";

export type MessagePathsForStructure = {
  path: string;
  terminatingStructureItem: MessagePathStructureItem;
}[];
