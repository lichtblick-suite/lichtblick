/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import * as MessagePathSyntax from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import * as StructureAllItems from "@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath";
import { useStructuredItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useStructureItemsByPath";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useStructureItemsByPathStore } from "./useStructureItemsByPathStore";

// Mock helpers
jest.mock("@lichtblick/suite-base/PanelAPI");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath");
jest.mock("./useStructureItemsByPathStore");

describe("useStructuredItemsByPath", () => {
  const mockSchemaName = BasicBuilder.string();
  const mockStructureItemPath = `/${BasicBuilder.string()}`;
  const mockComputedItemPath = `/${BasicBuilder.string()}`;
  const mockAllStructureItems = new Map([[mockStructureItemPath, { path: mockStructureItemPath }]]);
  const mockTopics = [{ name: `/${BasicBuilder.string()}`, datatype: mockSchemaName }];
  const mockDatatypes = { [mockSchemaName]: { fields: [] } };

  beforeEach(() => {
    jest.clearAllMocks();

    (useStructureItemsByPathStore as unknown as jest.Mock).mockReturnValue(mockAllStructureItems);

    (PanelAPI.useDataSourceInfo as jest.Mock).mockReturnValue({
      datatypes: mockDatatypes,
      topics: mockTopics,
    });

    (MessagePathSyntax.messagePathStructures as jest.Mock).mockImplementation(() => ({
      [mockSchemaName]: [],
    }));

    (StructureAllItems.structureAllItemsByPath as jest.Mock).mockReturnValue(
      new Map([[mockComputedItemPath, { path: mockComputedItemPath }]]),
    );
  });

  it("returns precomputed structure when noMultiSlices and validTypes are undefined", () => {
    const { result } = renderHook(() => useStructuredItemsByPath({}));

    expect(result.current).toEqual(mockAllStructureItems);
    expect(StructureAllItems.structureAllItemsByPath).not.toHaveBeenCalled();
  });

  it("calls structureAllItemsByPath when validTypes is passed", () => {
    const { result } = renderHook(() => useStructuredItemsByPath({ validTypes: [mockSchemaName] }));

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledWith(
      expect.objectContaining({
        validTypes: [mockSchemaName],
        topics: mockTopics,
      }),
    );
    expect(result.current).toEqual(
      new Map([[mockComputedItemPath, { path: mockComputedItemPath }]]),
    );
  });

  it("calls structureAllItemsByPath when noMultiSlices is true", () => {
    const { result } = renderHook(() => useStructuredItemsByPath({ noMultiSlices: true }));

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalled();
    expect(result.current).toEqual(
      new Map([[mockComputedItemPath, { path: mockComputedItemPath }]]),
    );
  });

  it("memoizes messagePathStructures by datatypes", () => {
    renderHook(() => useStructuredItemsByPath({ validTypes: [mockSchemaName] }));

    expect(MessagePathSyntax.messagePathStructures).toHaveBeenCalledWith(mockDatatypes);
  });
  it("memoizes the computed map across re-renders with an equal (but new) validTypes array", () => {
    const { rerender } = renderHook(
      ({ validTypes }: { validTypes: string[] }) => useStructuredItemsByPath({ validTypes }),
      { initialProps: { validTypes: [mockSchemaName] } },
    );

    // Re-render with a brand-new array instance that has identical content.
    rerender({ validTypes: [mockSchemaName] });

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledTimes(1);
  });

  it("recomputes when the validTypes content changes", () => {
    const { rerender } = renderHook(
      ({ validTypes }: { validTypes: string[] }) => useStructuredItemsByPath({ validTypes }),
      { initialProps: { validTypes: [BasicBuilder.string()] } },
    );

    rerender({ validTypes: [BasicBuilder.string()] });

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledTimes(2);
  });

  it("recomputes when validTypes differ only by comma placement (no join-collision)", () => {
    const { rerender } = renderHook(
      ({ validTypes }: { validTypes: string[] }) => useStructuredItemsByPath({ validTypes }),
      { initialProps: { validTypes: ["a,b", "c"] } },
    );

    // ["a,b","c"] and ["a","b,c"] both join to "a,b,c"; a join-based key would
    // collide and skip recomputation. JSON.stringify keeps them distinct.
    rerender({ validTypes: ["a", "b,c"] });

    expect(StructureAllItems.structureAllItemsByPath).toHaveBeenCalledTimes(2);
  });
});
