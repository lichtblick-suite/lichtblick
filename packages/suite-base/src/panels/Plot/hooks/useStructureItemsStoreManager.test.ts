/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import * as MessagePathSyntax from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import * as StructureAllItems from "@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath";
import { useStructureItemsByPathStore } from "@lichtblick/suite-base/components/MessagePathSyntax/useStructureItemsByPathStore";

import { useStructureItemsStoreManager } from "./useStructureItemsStoreManager";

jest.mock("@lichtblick/suite-base/PanelAPI");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/useStructureItemsByPathStore");

describe("useStructureItemsStoreManager", () => {
  const mockSetAllStructureItemsByPath = jest.fn();
  const mockTopics = [{ name: "/camera", datatype: "sensor_msgs/Image" }];
  const mockDatatypes = {
    "sensor_msgs/Image": {
      fields: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useStructureItemsByPathStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector({ setStructureItemsByPath: mockSetAllStructureItemsByPath }),
    );

    (PanelAPI.useDataSourceInfo as jest.Mock).mockReturnValue({
      datatypes: mockDatatypes,
      topics: mockTopics,
    });

    (MessagePathSyntax.messagePathStructures as jest.Mock).mockReturnValue({
      "sensor_msgs/Image": [{ path: "header" }],
    });

    (StructureAllItems.structureAllItemsByPath as jest.Mock).mockReturnValue(
      new Map([["/camera/header", { path: "/camera/header" }]]),
    );
  });

  it("calls structureAllItemsByPath and sets it in the store", () => {
    renderHook(() => {
      useStructureItemsStoreManager();
    });

    expect(MessagePathSyntax.messagePathStructures).toHaveBeenCalledWith(mockDatatypes);

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledWith({
      messagePathStructuresForDataype: {
        "sensor_msgs/Image": [{ path: "header" }],
      },
      topics: mockTopics,
    });

    expect(mockSetAllStructureItemsByPath).toHaveBeenCalledWith(
      new Map([["/camera/header", { path: "/camera/header" }]]),
    );
  });

  it("does not call structureAllItemsByPath again if topics and datatypes remain unchanged", () => {
    const { rerender } = renderHook(() => {
      useStructureItemsStoreManager();
    });
    rerender();
    rerender();
    rerender();

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledTimes(1);
  });
});
