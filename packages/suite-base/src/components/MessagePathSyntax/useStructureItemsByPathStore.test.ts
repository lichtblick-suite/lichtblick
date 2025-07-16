// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act } from "@testing-library/react";

import { MessagePathStructureItem } from "@lichtblick/message-path/src/types";

import { useStructureItemsByPathStore } from "./useStructureItemsByPathStore";

describe("useStructureItemsByPathStore", () => {
  it("sets allStructureItemsByPath", () => {
    const mockMessagePathStructureItem: MessagePathStructureItem = {
      structureType: "primitive",
      primitiveType: "string",
      datatype: "string",
    };
    const structureItemsPathMap = new Map<string, MessagePathStructureItem>();
    structureItemsPathMap.set("1", mockMessagePathStructureItem);

    act(() => {
      useStructureItemsByPathStore.getState().setAllStructureItemsByPath(structureItemsPathMap);
    });
    const state = useStructureItemsByPathStore.getState();

    expect(state.allStructureItemsByPath).toEqual(structureItemsPathMap);
  });
});
