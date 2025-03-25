/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSnackbar } from "notistack";

import { Immutable } from "@lichtblick/suite/src/immutable";
import { ExtensionDetails } from "@lichtblick/suite-base/components/ExtensionDetails";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

jest.mock("notistack", () => ({
  useSnackbar: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/ExtensionCatalogContext", () => ({
  useExtensionCatalog: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/ExtensionMarketplaceContext", () => ({
  useExtensionMarketplace: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => jest.fn());

describe("ExtensionDetails Component", () => {
  const mockEnqueueSnackbar = jest.fn();
  const mockLogEvent = jest.fn();
  const mockDownloadExtension = jest.fn();
  const mockInstallExtensions = jest.fn();
  const mockUninstallExtension = jest.fn();
  const mockGetMarkdown = jest.fn();

  const mockExtension: Immutable<ExtensionMarketplaceDetail> = {
    id: BasicBuilder.string(),
    name: BasicBuilder.string(),
    qualifiedName: BasicBuilder.string(),
    description: BasicBuilder.string(),
    publisher: BasicBuilder.string(),
    homepage: BasicBuilder.string(),
    license: BasicBuilder.string(),
    version: BasicBuilder.string(),
    readme: BasicBuilder.string(),
    changelog: BasicBuilder.string(),
    foxe: BasicBuilder.string(),
    namespace: "local",
  };

  beforeEach(() => {
    (useSnackbar as jest.Mock).mockReturnValue({ enqueueSnackbar: mockEnqueueSnackbar });
    (useAnalytics as jest.Mock).mockReturnValue({ logEvent: mockLogEvent });
    (useExtensionCatalog as jest.Mock).mockImplementation((selector) => {
      const mockExtensionCatalog = {
        downloadExtension: mockDownloadExtension,
        installExtensions: mockInstallExtensions,
        uninstallExtension: mockUninstallExtension,
        refreshExtensions: jest.fn(),
        installedExtensions: [],
        installedPanels: {},
        installedMessageConverters: [],
        installedTopicAliasFunctions: {},
        panelSettings: {},
      };
      return selector(mockExtensionCatalog);
    });
    (useExtensionMarketplace as jest.Mock).mockReturnValue({
      getMarkdown: mockGetMarkdown,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the extension details correctly", () => {
    render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={false} />);
    expect(screen.getByText(new RegExp(mockExtension.name, "i"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`v${mockExtension.version}`, "i"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockExtension.license, "i"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockExtension.publisher, "i"))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(mockExtension.description, "i"))).toBeInTheDocument();
    expect(screen.getByText("README")).toBeInTheDocument();
    expect(screen.getByText("CHANGELOG")).toBeInTheDocument();
  });

  it("calls onClose when the back button is clicked", () => {
    const mockOnClose = jest.fn();
    render(<ExtensionDetails extension={mockExtension} onClose={mockOnClose} installed={false} />);

    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  describe("download and install process", () => {
    it("handles the download and install process successfully on desktop app", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      mockDownloadExtension.mockResolvedValue(new Uint8Array());
      mockInstallExtensions.mockResolvedValue({});

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={false} />);

      const installButton = screen.getByText("Install");
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockDownloadExtension).toHaveBeenCalledWith(mockExtension.foxe);
        expect(mockInstallExtensions).toHaveBeenCalledWith("local", [expect.any(Uint8Array)]);
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          `${mockExtension.name} installed successfully`,
          { variant: "success" },
        );
        expect(mockLogEvent).toHaveBeenCalledWith("Studio: Extension Installed", {
          type: mockExtension.id,
        });
      });
    });

    it("displays an error message when not on desktop app", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(false);

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={false} />);

      const installButton = screen.getByText("Install");
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          "Download the desktop app to use marketplace extensions.",
          { variant: "error" },
        );
        expect(mockDownloadExtension).not.toHaveBeenCalled();
        expect(mockInstallExtensions).not.toHaveBeenCalled();
      });
    });

    it("displays an error message when the download and install process fails on desktop app", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      mockDownloadExtension.mockRejectedValue(new Error("Download failed"));

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={false} />);

      const installButton = screen.getByText("Install");
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          `Failed to install extension ${mockExtension.id}. Download failed`,
          { variant: "error" },
        );
      });
    });
  });

  it("handles the uninstall process successfully", async () => {
    mockUninstallExtension.mockResolvedValue(undefined);

    render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);

    const uninstallButton = screen.getByText("Uninstall");
    fireEvent.click(uninstallButton);

    await waitFor(() => {
      expect(mockUninstallExtension).toHaveBeenCalledWith(
        mockExtension.namespace,
        mockExtension.id,
      );
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        `${mockExtension.name} uninstalled successfully`,
        { variant: "success" },
      );
      expect(mockLogEvent).toHaveBeenCalledWith("Studio: Extension Uninstalled", {
        type: mockExtension.id,
      });
    });
  });

  it("displays an error message when the uninstall process fails", async () => {
    mockUninstallExtension.mockRejectedValue(new Error("Uninstall failed"));

    render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);

    const uninstallButton = screen.getByText("Uninstall");
    fireEvent.click(uninstallButton);

    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        `Failed to uninstall extension ${mockExtension.id}. Uninstall failed`,
        { variant: "error" },
      );
    });
  });
});
