/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { useExtensionMarketplace } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

import useExtensionSettings from "./useExtensionSettings";

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext");
jest.mock("@lichtblick/suite-base/context/ExtensionMarketplaceContext");

describe("useExtensionSettings", () => {
  const mockInstalledExtensions = [
    {
      id: "1",
      displayName: "Extension 1",
      description: "Description 1",
      publisher: "Publisher 1",
      homepage: "http://example.com",
      license: "MIT",
      version: "1.0.0",
      keywords: ["keyword1"],
      namespace: "namespace1",
      qualifiedName: "qualifiedName1",
    },
  ];

  const mockAvailableExtensions = [
    {
      id: "2",
      name: "Extension 2",
      description: "Description 2",
      publisher: "Publisher 2",
      homepage: "http://example.com",
      license: "MIT",
      version: "1.0.0",
      keywords: ["keyword2"],
      namespace: "namespace2",
    },
  ];

  const setupHook = async () => {
    const renderHookReturn = renderHook(() => useExtensionSettings());

    // Needed to trigger useEffect
    await act(async () => {
      await renderHookReturn.result.current.refreshMarketplaceEntries();
    });

    return renderHookReturn;
  };

  beforeEach(() => {
    (useExtensionCatalog as jest.Mock).mockReturnValue(mockInstalledExtensions);

    (useExtensionMarketplace as jest.Mock).mockReturnValue({
      getAvailableExtensions: jest.fn().mockResolvedValue(mockAvailableExtensions),
    });
  });

  it("should initialize correctly", async () => {
    const { result } = await setupHook();

    expect(result.current.undebouncedFilterText).toBe("");
    expect(result.current.debouncedFilterText).toBe("");
  });

  it("should update filter text", async () => {
    const { result } = await setupHook();

    act(() => {
      result.current.setUndebouncedFilterText("test");
    });

    expect(result.current.undebouncedFilterText).toBe("test");
  });

  it("should group marketplace entries by namespace", async () => {
    const { result } = await setupHook();

    expect(result.current.groupedMarketplaceData).toEqual([
      {
        namespace: "namespace2",
        entries: [mockAvailableExtensions[0]],
      },
    ]);
  });

  it("should group installed entries by namespace", async () => {
    const { result } = await setupHook();

    expect(result.current.namespacedData).toEqual([
      {
        namespace: "namespace1",
        entries: [
          {
            ...mockInstalledExtensions[0],
            installed: true,
            name: mockInstalledExtensions[0]!.displayName,
          },
        ],
      },
    ]);
  });
});
