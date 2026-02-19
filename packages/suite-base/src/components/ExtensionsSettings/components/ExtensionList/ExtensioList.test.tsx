/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";

import "@testing-library/jest-dom";
import { Immutable } from "@lichtblick/suite";
import ExtensionList, {
  displayNameForNamespace,
  generatePlaceholderList,
} from "@lichtblick/suite-base/components/ExtensionsSettings/components/ExtensionList/ExtensionList";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
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
  const mockEntries = [
    {
      id: "1",
      name: "Extension",
      description: "Description of Extension 1",
      publisher: "Publisher 1",
      version: "1.0.0",
      qualifiedName: "org.extension1",
      homepage: BasicBuilder.string(),
      license: BasicBuilder.string(),
      displayName: "DisplayName-Extension 1",
      keywords: [BasicBuilder.string()],
    },
    {
      id: "2",
      name: "Extension2",
      description: "Description of Extension 2",
      publisher: "Publisher 2",
      version: "1.0.0",
      qualifiedName: "org.extension2",
      homepage: BasicBuilder.string(),
      license: BasicBuilder.string(),
      displayName: "DisplayName-Extension 2",
      keywords: [BasicBuilder.string()],
    },
  ];
  const mockFilterText = "Extension";
  const mockSelectExtension = jest.fn();

  const emptyMockEntries: Immutable<ExtensionMarketplaceDetail>[] = [];

  it("renders the list of extensions correctly", () => {
    render(
      <ExtensionList
        namespace={mockNamespace}
        entries={mockEntries}
        filterText={mockFilterText}
        selectExtension={mockSelectExtension}
      />,
    );
    //Since namespace passed was 'org' displayNameForNamespace() transformed it to 'Organization'
    expect(screen.getByText("Organization")).toBeInTheDocument();

    //finds 2 elements that represent the entries from mockEntries
    const elements = screen.getAllByText("Extension");
    expect(elements.length).toEqual(2);
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
});
