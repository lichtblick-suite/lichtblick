/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";

import { InstalledExtension } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { useExtensionMarketplace } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";

import useExtensionSettings from "./useExtensionSettings";

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext");
jest.mock("@lichtblick/suite-base/context/ExtensionMarketplaceContext");

describe("useExtensionSettings", () => {
  const mockInstalledExtensions: InstalledExtension[] = [
    {
      id: "4",
      displayName: "Extension 4",
      description: "Description 4",
      publisher: "Publisher 4",
      homepage: "http://example.com",
      license: "MIT",
      version: "1.0.0",
      keywords: ["keyword4"],
      namespace: "namespace1",
      installed: true,
      name: "Extension 4",
      qualifiedName: "Extension 4",
    },
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
      installed: true,
      name: "Extension 1",
      qualifiedName: "Extension 1",
    },
  ];

  const mockAvailableExtensions = [
    {
      id: "5",
      name: "Extension 2",
      description: "Description 2",
      publisher: "Publisher 2",
      homepage: "http://example.com",
      license: "MIT",
      version: "1.0.0",
      keywords: ["keyword2"],
      namespace: "namespace2",
    },
    {
      id: "6",
      name: "Extension 1",
      description: "Description 1",
      publisher: "Publisher 1",
      homepage: "http://example.com",
      license: "MIT",
      version: "1.0.0",
      keywords: ["keyword1"],
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
        entries: [mockAvailableExtensions[1], mockAvailableExtensions[0]],
      },
    ]);
  });

  it("should group installed entries by namespace", async () => {
    const { result } = await setupHook();

    expect(result.current.namespacedData).toEqual([
      {
        namespace: "namespace1",
        entries: expect.arrayContaining([
          {
            ...mockInstalledExtensions[1],
            name: mockInstalledExtensions[1]?.displayName,
          },
          {
            ...mockInstalledExtensions[0],
            name: mockInstalledExtensions[0]?.displayName,
          },
        ]),
      },
    ]);
  });
});
