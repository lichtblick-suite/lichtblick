/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslation } from "react-i18next";
import "@testing-library/jest-dom";
import { AsyncState } from "react-use/lib/useAsyncFn";

import useExtensionSettings from "@lichtblick/suite-base/components/ExtensionsSettings/hooks/useExtensionSettings";
import { UseExtensionSettingsHook } from "@lichtblick/suite-base/components/ExtensionsSettings/types";
import { ExtensionMarketplaceDetail } from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import ExtensionsSettings from "./index";

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/components/ExtensionsSettings/hooks/useExtensionSettings");
jest.mock("react-i18next");

jest.mock("@lichtblick/suite-base/components/ExtensionDetails", () => ({
  ExtensionDetails: ({ extension, onClose }: any) => {
    return (
      <div data-testid="mock-extension-details">
        <p>{extension.name}</p>
        <button data-testid="mockCloseExtension" onClick={onClose}>
          Close
        </button>
      </div>
    );
  },
}));

describe("ExtensionsSettings", () => {
  const mockSetUndebouncedFilterText = jest.fn();
  const mockRefreshMarketplaceEntries = jest.fn();

  function setUpHook(props?: Partial<UseExtensionSettingsHook>) {
    (useExtensionSettings as jest.Mock).mockReturnValue({
      setUndebouncedFilterText: mockSetUndebouncedFilterText,
      marketplaceEntries: { error: undefined },
      refreshMarketplaceEntries: mockRefreshMarketplaceEntries,
      undebouncedFilterText: "",
      namespacedData: [
        {
          namespace: "org",
          entries: [
            {
              id: "1",
              name: "Extension",
              description: "Description of Extension 1",
              publisher: "Publisher 1",
              version: "1.0.0",
              qualifiedName: "org.extension1",
              homepage: BasicBuilder.string(),
              license: BasicBuilder.string(),
            },
          ],
        },
        { namespace: "Org2", entries: [] },
      ],
      groupedMarketplaceData: [{ namespace: "MarketPlace", entries: [] }],
      debouncedFilterText: "",
      ...props,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setUpHook();

    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  it("renders the search bar and three extension lists", () => {
    render(<ExtensionsSettings />);

    expect(screen.getByTestId("SearchBarComponent")).toBeInTheDocument();

    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Org2")).toBeInTheDocument();
    expect(screen.getByText("MarketPlace")).toBeInTheDocument();
  });

  it("handles search bar input", async () => {
    render(<ExtensionsSettings />);

    const searchInput = screen.getByPlaceholderText("searchExtensions");
    await userEvent.type(searchInput, "test");

    expect(mockSetUndebouncedFilterText).toHaveBeenCalledWith("t");
    expect(mockSetUndebouncedFilterText).toHaveBeenCalledWith("e");
    expect(mockSetUndebouncedFilterText).toHaveBeenCalledWith("s");
    expect(mockSetUndebouncedFilterText).toHaveBeenCalledWith("t");
  });

  it("should clear text when onClose() is called", async () => {
    setUpHook({ debouncedFilterText: BasicBuilder.string() });
    render(<ExtensionsSettings />);

    const clearSearchButton = screen.getByTestId("ClearIcon");
    await userEvent.click(clearSearchButton);

    expect(mockSetUndebouncedFilterText).toHaveBeenCalledWith("");
  });

  it("displays an error alert when marketplaceEntries.error is set", () => {
    setUpHook({
      marketplaceEntries: { error: true } as unknown as AsyncState<ExtensionMarketplaceDetail[]>,
    });

    render(<ExtensionsSettings />);

    expect(screen.getByText("failedToRetrieveMarketplaceExtensions")).toBeInTheDocument();

    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);

    expect(mockRefreshMarketplaceEntries).toHaveBeenCalledTimes(1);
  });

  it("should render ExtensionDetails component if focusedExtension is defined and close it", async () => {
    render(<ExtensionsSettings />);
    const listItem = screen.getByText("Extension");

    await userEvent.click(listItem);
    expect(screen.queryByTestId("mock-extension-details")).toBeInTheDocument();

    const closeExtensionButton = screen.getByTestId("mockCloseExtension");
    await userEvent.click(closeExtensionButton);
    expect(screen.queryByTestId("mock-extension-details")).not.toBeInTheDocument();
  });
});
