/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSnackbar } from "notistack";

import { ExtensionDetails } from "@lichtblick/suite-base/components/ExtensionDetails";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import {
  ExtensionData,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import {
  ExtensionMarketplaceDetail,
  useExtensionMarketplace,
} from "@lichtblick/suite-base/context/ExtensionMarketplaceContext";
import ExtensionBuilder from "@lichtblick/suite-base/testing/builders/ExtensionBuilder";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";
import { BasicBuilder } from "@lichtblick/test-builders";

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

  const mockExtension: ExtensionMarketplaceDetail = ExtensionBuilder.extensionMarketplaceDetail({
    namespace: "local",
  });

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
        expect(mockInstallExtensions).toHaveBeenCalledWith("local", [
          { buffer: expect.any(Uint8Array) },
        ] as ExtensionData[]);
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

    it("displays readme correctly", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      const readmeContent = BasicBuilder.string();
      mockExtension.readme = readmeContent;

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);
      const readmeButton = screen.getByRole("tab", {
        name: /readme/i,
      });

      fireEvent.click(readmeButton);
      await waitFor(() => {
        expect(screen.getByText(readmeContent)).toBeInTheDocument();
      });
    });

    it("displays message indicating readme is not found when readme is undefined", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      mockExtension.readme = undefined;

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);
      const readmeButton = screen.getByRole("tab", {
        name: /readme/i,
      });

      fireEvent.click(readmeButton);
      await waitFor(() => {
        expect(screen.getByText(/No readme found/i)).toBeInTheDocument();
      });
    });

    it("displays changelog correctly", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      const changelogContent = BasicBuilder.string();
      mockExtension.changelog = changelogContent;

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);
      const changelogButton = screen.getByRole("tab", {
        name: /changelog/i,
      });

      fireEvent.click(changelogButton);
      await waitFor(() => {
        expect(screen.getByText(changelogContent)).toBeInTheDocument();
      });
    });

    it("displays message indicating changelog is not found when changelog is undefined", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      mockExtension.changelog = undefined;

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);
      const changelogButton = screen.getByRole("tab", {
        name: /changelog/i,
      });

      fireEvent.click(changelogButton);
      await waitFor(() => {
        expect(screen.getByText(/No changelog found/i)).toBeInTheDocument();
      });
    });

    it("displays an error message when the download and install process fails on desktop app", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      mockDownloadExtension.mockRejectedValue(new Error("Download failed"));

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={false} />);

      const installButton = screen.getByText("Install");
      fireEvent.click(installButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Download failed", { variant: "error" });
      });
    });

    it("hides install button when foxe URL is undefined", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      const extensionWithoutFoxe = { ...mockExtension, foxe: undefined };

      render(
        <ExtensionDetails extension={extensionWithoutFoxe} onClose={() => {}} installed={false} />,
      );

      const installButton = screen.queryByText("Install");
      expect(installButton).not.toBeInTheDocument();
    });

    it("does not log analytics event when component is unmounted before install completes", async () => {
      (isDesktopApp as jest.Mock).mockReturnValue(true);

      mockDownloadExtension.mockResolvedValue(new Uint8Array());
      mockInstallExtensions.mockResolvedValue({});

      const { unmount } = render(
        <ExtensionDetails extension={mockExtension} onClose={() => {}} installed={false} />,
      );

      const installButton = screen.getByText("Install");
      fireEvent.click(installButton);

      // Unmount before the async operation completes
      unmount();

      await waitFor(() => {
        expect(mockDownloadExtension).toHaveBeenCalled();
        expect(mockInstallExtensions).toHaveBeenCalled();
      });

      // logEvent should not be called because component was unmounted
      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });

  describe("uninstall process", () => {
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

    it("uses 'local' namespace when extension.namespace is undefined", async () => {
      mockUninstallExtension.mockResolvedValue(undefined);

      const extensionWithoutNamespace = { ...mockExtension, namespace: undefined };

      render(
        <ExtensionDetails
          extension={extensionWithoutNamespace}
          onClose={() => {}}
          installed={true}
        />,
      );

      const uninstallButton = screen.getByText("Uninstall");
      fireEvent.click(uninstallButton);

      await waitFor(() => {
        expect(mockUninstallExtension).toHaveBeenCalledWith("local", mockExtension.id);
      });
    });

    it("displays an error message when the uninstall process fails", async () => {
      mockUninstallExtension.mockRejectedValue(new Error("Uninstall failed"));

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);

      const uninstallButton = screen.getByText("Uninstall");
      fireEvent.click(uninstallButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Uninstall failed", { variant: "error" });
      });
    });

    it("displays fallback error message when uninstall fails with non-Error object", async () => {
      mockUninstallExtension.mockRejectedValue("String error");

      render(<ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />);

      const uninstallButton = screen.getByText("Uninstall");
      fireEvent.click(uninstallButton);

      await waitFor(() => {
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith("Failed to uninstall extension", {
          variant: "error",
        });
      });
    });

    it("does not log analytics event when component is unmounted before uninstall completes", async () => {
      mockUninstallExtension.mockImplementation(
        async () => await new Promise((resolve) => setTimeout(resolve, 300)),
      );

      const { unmount } = render(
        <ExtensionDetails extension={mockExtension} onClose={() => {}} installed={true} />,
      );

      const uninstallButton = screen.getByText("Uninstall");
      fireEvent.click(uninstallButton);

      // Unmount before the async operation completes
      unmount();

      await waitFor(() => {
        expect(mockUninstallExtension).toHaveBeenCalled();
      });

      // logEvent should not be called because component was unmounted
      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });
});
