/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SnackbarProvider } from "notistack";

import { NamespaceSelectionModal } from "@lichtblick/suite-base/components/NamespaceSelectionModal";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <SnackbarProvider>
      <ThemeProvider isDark={false}>{component}</ThemeProvider>
    </SnackbarProvider>,
  );
};

describe("NamespaceSelectionModal", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    files: [
      new File(["content"], "layout.json", { type: "application/json" }),
      new File(["content"], "extension.foxe", { type: "application/octet-stream" }),
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when modal is opened with mixed files", () => {
    it("should display correct file count and type description", () => {
      // Given
      const props = { ...defaultProps };

      // When
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // Then
      expect(screen.getByText("Choose Installation Location")).toBeInTheDocument();
      expect(
        screen.getByText(/You are about to install 2 extensions and layouts/),
      ).toBeInTheDocument();
      expect(screen.getByText(/layout\.json, extension\.foxe/)).toBeInTheDocument();
    });
  });

  describe("when modal is opened with only extension files", () => {
    it("should display correct type description for extensions", () => {
      // Given
      const props = {
        ...defaultProps,
        files: [new File(["content"], "extension.foxe", { type: "application/octet-stream" })],
      };

      // When
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // Then
      expect(screen.getByText(/You are about to install 1 extensions/)).toBeInTheDocument();
      expect(screen.getByText(/extension\.foxe/)).toBeInTheDocument();
    });
  });

  describe("when modal is opened with only layout files", () => {
    it("should display correct type description for layouts", () => {
      // Given
      const props = {
        ...defaultProps,
        files: [new File(["content"], "-layout.json", { type: "application/json" })],
      };

      // When
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // Then
      expect(screen.getByText(/You are about to install 1 layouts/)).toBeInTheDocument();
      expect(screen.getByText(/-layout\.json/)).toBeInTheDocument();
    });
  });

  describe("when user selects local namespace", () => {
    it("should call onSelect with 'local' namespace", () => {
      // Given
      const props = { ...defaultProps };
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // When
      fireEvent.click(screen.getByText("Local"));
      fireEvent.click(screen.getByText("Install"));

      // Then
      expect(props.onSelect).toHaveBeenCalledWith("local");
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  describe("when user selects organization namespace", () => {
    it("should call onSelect with 'org' namespace", () => {
      // Given
      const props = { ...defaultProps };
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // When
      fireEvent.click(screen.getByText("Organization"));
      fireEvent.click(screen.getByText("Install"));

      // Then
      expect(props.onSelect).toHaveBeenCalledWith("org");
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  describe("when user clicks cancel button", () => {
    it("should call onClose without calling onSelect", () => {
      // Given
      const props = { ...defaultProps };
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // When
      fireEvent.click(screen.getByText("Cancel"));

      // Then
      expect(props.onClose).toHaveBeenCalled();
      expect(props.onSelect).not.toHaveBeenCalled();
    });
  });

  describe("when modal is closed", () => {
    it("should not render modal content", () => {
      // Given
      const props = { ...defaultProps, open: false };

      // When
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // Then
      expect(screen.queryByText("Choose Installation Location")).not.toBeInTheDocument();
    });
  });

  describe("when local namespace is pre-selected", () => {
    it("should show local option as selected by default", () => {
      // Given
      const props = { ...defaultProps };

      // When
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // Then
      const localButton = screen.getByText("Local").closest("div[role='button']");
      expect(localButton).toHaveClass("Mui-selected");
    });
  });

  describe("when user changes namespace selection", () => {
    it("should update the selected option visually", () => {
      // Given
      const props = { ...defaultProps };
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // When
      fireEvent.click(screen.getByText("Organization"));

      // Then
      const orgButton = screen.getByText("Organization").closest("div[role='button']");
      const localButton = screen.getByText("Local").closest("div[role='button']");

      expect(orgButton).toHaveClass("Mui-selected");
      expect(localButton).not.toHaveClass("Mui-selected");
    });
  });

  describe("when modal displays installation options", () => {
    it("should show both local and organization options with descriptions", () => {
      // Given
      const props = { ...defaultProps };

      // When
      renderWithProviders(<NamespaceSelectionModal {...props} />);

      // Then
      expect(screen.getByText("Local")).toBeInTheDocument();
      expect(screen.getByText("Organization")).toBeInTheDocument();
      expect(screen.getByText(/Install only on this device/)).toBeInTheDocument();
      expect(screen.getByText(/Install for your entire organization/)).toBeInTheDocument();
    });
  });
});
