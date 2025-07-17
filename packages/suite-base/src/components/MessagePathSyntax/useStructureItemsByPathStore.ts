// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import { MessagePathStructureItem } from "@lichtblick/message-path";

type StructuredItemsState = {
  structureItemsByPath: Map<string, MessagePathStructureItem>;
  setStructureItemsByPath: (items: Map<string, MessagePathStructureItem>) => void;
};

export const useStructureItemsByPathStore = create<StructuredItemsState>((set) => ({
  structureItemsByPath: new Map(),
  setStructureItemsByPath: (items) => {
    set({ structureItemsByPath: items });
  },
}));
