/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import * as MessagePathSyntax from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import * as StructureAllItems from "@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath";
import { useStructuredItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useStructureItemsByPath";

import { useStructureItemsByPathStore } from "./useStructureItemsByPathStore";

// Mock helpers
jest.mock("@lichtblick/suite-base/PanelAPI");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath");
jest.mock("./useStructureItemsByPathStore");

describe("useStructuredItemsByPath", () => {
  const mockAllStructureItems = new Map([["/foo", { path: "/foo" }]]);
  const mockTopics = [{ name: "/topic", datatype: "foo_msgs/Bar" }];
  const mockDatatypes = { "foo_msgs/Bar": { fields: [] } };

  beforeEach(() => {
    jest.clearAllMocks();

    (useStructureItemsByPathStore as unknown as jest.Mock).mockReturnValue(mockAllStructureItems);

    (PanelAPI.useDataSourceInfo as jest.Mock).mockReturnValue({
      datatypes: mockDatatypes,
      topics: mockTopics,
    });

    (MessagePathSyntax.messagePathStructures as jest.Mock).mockImplementation(() => ({
      "foo_msgs/Bar": [],
    }));

    (StructureAllItems.structureAllItemsByPath as jest.Mock).mockReturnValue(
      new Map([["/computed", { path: "/computed" }]]),
    );
  });

  it("returns precomputed structure when noMultiSlices and validTypes are undefined", () => {
    const { result } = renderHook(() => useStructuredItemsByPath({}));

    expect(result.current).toEqual(mockAllStructureItems);
    expect(StructureAllItems.structureAllItemsByPath).not.toHaveBeenCalled();
  });

  it("calls structureAllItemsByPath when validTypes is passed", () => {
    const { result } = renderHook(() => useStructuredItemsByPath({ validTypes: ["foo_msgs/Bar"] }));

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledWith(
      expect.objectContaining({
        validTypes: ["foo_msgs/Bar"],
        topics: mockTopics,
      }),
    );
    expect(result.current).toEqual(new Map([["/computed", { path: "/computed" }]]));
  });

  it("calls structureAllItemsByPath when noMultiSlices is true", () => {
    const { result } = renderHook(() => useStructuredItemsByPath({ noMultiSlices: true }));

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalled();
    expect(result.current).toEqual(new Map([["/computed", { path: "/computed" }]]));
  });

  it("memoizes messagePathStructures by datatypes", () => {
    renderHook(() => useStructuredItemsByPath({ validTypes: ["foo_msgs/Bar"] }));

    expect(MessagePathSyntax.messagePathStructures).toHaveBeenCalledWith(mockDatatypes);
  });
});
