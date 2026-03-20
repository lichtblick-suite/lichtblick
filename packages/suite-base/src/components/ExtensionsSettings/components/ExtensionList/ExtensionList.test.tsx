/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import "@testing-library/jest-dom";

import { Immutable } from "@lichtblick/suite";
import ExtensionList from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionList/ExtensionList";
import {
  displayNameForNamespace,
  generatePlaceholderList,
} from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionList/utils";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => jest.fn());

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

const mockEnqueueSnackbar = jest.fn();
jest.mock("notistack", () => ({
  ...jest.requireActual("notistack"),
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar,
  }),
}));

describe("ExtensionList utility functions", () => {
  describe("displayNameForNamespace", () => {
    it("returns 'Organization' for 'org'", () => {
      expect(displayNameForNamespace("org")).toBe("Organization");
    });

    it("returns the namespace itself for other values", () => {
      const customNamespace = BasicBuilder.string();
      expect(displayNameForNamespace(customNamespace)).toBe(customNamespace);
    });
  });

  describe("generatePlaceholderList", () => {
    it("renders a placeholder list with the given message", () => {
      const message = BasicBuilder.string();
      render(generatePlaceholderList(message));
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it("renders an empty list item when no message is provided", () => {
      render(generatePlaceholderList());
      expect(screen.getByRole("listitem")).toBeInTheDocument();
    });
  });
});

describe("ExtensionList Component", () => {
  const mockNamespace = "org";
  const mockEntries: Immutable<ExtensionMarketplaceDetail>[] = [
    ExtensionBuilder.extensionMarketplaceDetail({
      name: "Extension",
      id: "1",
      namespace: mockNamespace,
    }),
    ExtensionBuilder.extensionMarketplaceDetail({
      name: "Extension2",
      id: "2",
      namespace: mockNamespace,
    }),
  ];
  const mockFilterText = "Extension";
  const mockSelectExtension = jest.fn();

  const emptyMockEntries: Immutable<ExtensionMarketplaceDetail>[] = [];

  beforeEach(() => {
    // Mock useExtensionCatalog as a Zustand selector hook
    (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
      const mockState = {
        installedExtensions: [],
        uninstallExtension: jest.fn(),
      };
      return selector(mockState);
    });

    // Clear mock call history
    mockEnqueueSnackbar.mockClear();
  });

  it("renders the list of extensions correctly", () => {
    // Given/When
    render(
      <ExtensionList
        namespace={mockNamespace}
        entries={mockEntries}
        filterText={mockFilterText}
        selectExtension={mockSelectExtension}
      />,
    );

    // Then
    //Since namespace passed was 'org' displayNameForNamespace() transformed it to 'Organization'
    expect(screen.getByText("Organization")).toBeInTheDocument();

    expect(screen.getByText("Extension")).toBeInTheDocument();
    expect(screen.getByText("Extension2")).toBeInTheDocument();
  });

  it("renders 'No extensions found' message when entries are empty and there's filterText", () => {
    const randomSearchValue = BasicBuilder.string();
    render(
      <ExtensionList
        namespace={mockNamespace}
        entries={emptyMockEntries}
        filterText={randomSearchValue}
        selectExtension={mockSelectExtension}
      />,
    );

    expect(screen.getByText("No extensions found")).toBeInTheDocument();
  });

  it("renders 'No extensions available' message when entries are empty", () => {
    render(
      <ExtensionList
        namespace={mockNamespace}
        entries={emptyMockEntries}
        filterText=""
        selectExtension={mockSelectExtension}
      />,
    );

    expect(screen.getByText("No extensions available")).toBeInTheDocument();
  });

  it("calls selectExtension with the correct parameters when an entry is clicked", () => {
    render(
      <ExtensionList
        namespace={mockNamespace}
        entries={mockEntries}
        filterText=""
        selectExtension={mockSelectExtension}
      />,
    );

    const firstEntry = screen.getByText("Extension");
    firstEntry.click();

    expect(mockSelectExtension).toHaveBeenCalledWith({
      installed: false,
      entry: mockEntries[0],
    });
  });

  it("calls selectExtension with installed true when clicking an installed extension", () => {
    // Given
    (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
      const mockState = {
        installedExtensions: [mockEntries[0]],
        uninstallExtension: jest.fn(),
      };
      return selector(mockState);
    });

    render(
      <ExtensionList
        namespace={mockNamespace}
        entries={mockEntries}
        filterText=""
        selectExtension={mockSelectExtension}
      />,
    );

    // When
    screen.getByText("Extension").click();

    // Then
    expect(mockSelectExtension).toHaveBeenCalledWith({
      installed: true,
      entry: mockEntries[0],
    });
  });

  describe("handleBulkUninstall", () => {
    const mockUninstallExtension = jest.fn();

    beforeEach(() => {
      mockUninstallExtension.mockClear();

      (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
        const mockState = {
          installedExtensions: mockEntries,
          uninstallExtension: mockUninstallExtension,
        };
        return selector(mockState);
      });
    });

    it("uninstalls selected extensions", async () => {
      // Given
      render(
        <ExtensionList
          namespace={mockNamespace}
          entries={mockEntries}
          filterText={mockFilterText}
          selectExtension={mockSelectExtension}
        />,
      );

      // When
      const checkboxes = screen.getAllByRole("checkbox", { name: /select row/i });
      fireEvent.click(checkboxes[0]!); // Select first extension
      fireEvent.click(checkboxes[1]!); // Select second extension

      // Then
      const uninstallButton = await screen.findByRole("button", { name: "Uninstall 2" });
      expect(uninstallButton).toBeInTheDocument();

      // When
      fireEvent.click(uninstallButton);

      // Then
      await waitFor(() => {
        expect(mockUninstallExtension).toHaveBeenCalledTimes(2);
        expect(mockUninstallExtension).toHaveBeenCalledWith(
          mockEntries[0]!.namespace,
          mockEntries[0]!.id,
        );
        expect(mockUninstallExtension).toHaveBeenCalledWith(
          mockEntries[1]!.namespace,
          mockEntries[1]!.id,
        );
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          "2 extension(s) uninstalled successfully",
          { variant: "success" },
        );
      });
    });

    it("does not show uninstall button when selected extensions are not installed", async () => {
      // Given - override to have NO installed extensions
      (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
        const mockState = {
          installedExtensions: [], // Empty - nothing installed
          uninstallExtension: mockUninstallExtension,
        };
        return selector(mockState);
      });

      render(
        <ExtensionList
          namespace={mockNamespace}
          entries={mockEntries}
          filterText={mockFilterText}
          selectExtension={mockSelectExtension}
        />,
      );

      // When
      const checkboxes = screen.getAllByRole("checkbox", { name: /select row/i });
      fireEvent.click(checkboxes[0]!); // Select first extension
      fireEvent.click(checkboxes[1]!); // Select second extension

      // Then - should show selected count but no uninstall button
      expect(screen.getByText("2 selected")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /uninstall/i })).not.toBeInTheDocument();
    });

    it("shows snackbar when only some selected extensions are installed", async () => {
      // Given
      (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
        const mockState = {
          installedExtensions: [mockEntries[0]], // Only first one installed
          uninstallExtension: mockUninstallExtension,
        };
        return selector(mockState);
      });

      render(
        <ExtensionList
          namespace={mockNamespace}
          entries={mockEntries}
          filterText={mockFilterText}
          selectExtension={mockSelectExtension}
        />,
      );

      // When
      const checkboxes = screen.getAllByRole("checkbox", { name: /select row/i });
      fireEvent.click(checkboxes[0]!); // installed
      fireEvent.click(checkboxes[1]!); // not installed

      // Then
      const uninstallButton = await screen.findByRole("button", { name: "Uninstall 1" });
      expect(uninstallButton).toBeInTheDocument();

      // When
      fireEvent.click(uninstallButton);

      // Then
      await waitFor(() => {
        expect(mockUninstallExtension).toHaveBeenCalledTimes(1);
        expect(mockUninstallExtension).toHaveBeenCalledWith(
          mockEntries[0]!.namespace,
          mockEntries[0]!.id,
        );
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          "1 extension(s) uninstalled successfully",
          { variant: "success" },
        );
      });
    });

    it("shows both success and error snackbars when some uninstalls fail", async () => {
      // Given
      mockUninstallExtension
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error("Second uninstall failed")); // Second call fails

      // This is needed to supress the error log from the failed uninstall in the test output, since we are intentionally causing it to fail to test the error handling
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      render(
        <ExtensionList
          namespace={mockNamespace}
          entries={mockEntries}
          filterText={mockFilterText}
          selectExtension={mockSelectExtension}
        />,
      );

      // When
      const checkboxes = screen.getAllByRole("checkbox", { name: /select row/i });
      fireEvent.click(checkboxes[0]!);
      fireEvent.click(checkboxes[1]!);

      const uninstallButton = await screen.findByRole("button", { name: "Uninstall 2" });
      fireEvent.click(uninstallButton);

      // Then
      await waitFor(() => {
        expect(mockUninstallExtension).toHaveBeenCalledTimes(2);
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          "1 extension(s) uninstalled successfully",
          { variant: "success" },
        );
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith("1 extension(s) failed to uninstall", {
          variant: "error",
        });
      });

      // Restore console.error to its original implementation after the test
      consoleErrorSpy.mockRestore();
    });

    it("clears selection after bulk uninstall completes", async () => {
      // Given
      mockUninstallExtension.mockResolvedValue(undefined);

      render(
        <ExtensionList
          namespace={mockNamespace}
          entries={mockEntries}
          filterText={mockFilterText}
          selectExtension={mockSelectExtension}
        />,
      );

      const checkboxes = screen.getAllByRole("checkbox", { name: /select row/i });
      fireEvent.click(checkboxes[0]!);
      fireEvent.click(checkboxes[1]!);

      const uninstallButton = await screen.findByRole("button", { name: "Uninstall 2" });

      // When
      fireEvent.click(uninstallButton);

      // Then
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /uninstall/i })).not.toBeInTheDocument();
      });
    });
  });

  describe("Actions column renderCell", () => {
    beforeEach(() => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);
    });

    it("renders an Install button for an extension that is not installed", () => {
      // Given
      const entry = ExtensionBuilder.extensionMarketplaceDetail({ namespace: "org" });

      // When
      render(
        <ExtensionList
          namespace="org"
          entries={[entry]}
          filterText=""
          selectExtension={jest.fn()}
        />,
      );

      // Then
      expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    });

    it("renders an Uninstall button for an extension that is installed", () => {
      // Given
      const entry = ExtensionBuilder.extensionMarketplaceDetail({ namespace: "org" });

      (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
        const mockState = {
          installedExtensions: [entry],
          uninstallExtension: jest.fn(),
        };
        return selector(mockState);
      });

      // When
      render(
        <ExtensionList
          namespace="org"
          entries={[entry]}
          filterText=""
          selectExtension={jest.fn()}
        />,
      );

      // Then
      expect(screen.getByRole("button", { name: "Uninstall" })).toBeInTheDocument();
    });
  });
});
