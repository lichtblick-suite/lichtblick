/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { SnackbarProvider } from "notistack";
import { act } from "react";
import { createRoot } from "react-dom/client";

import MultiDropZoneListener from "@lichtblick/suite-base/components/MultiDropZoneListener/MultiDropZoneListener";
import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

describe("<MultiDropZoneListener>", () => {
  let wrapper: HTMLDivElement;
  let mockOnDrop: jest.Mock;
  let root: any;

  beforeEach(() => {
    wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    mockOnDrop = jest.fn();
  });

  afterEach(() => {
    if (root != undefined) {
      root.unmount();
    }
    document.body.removeChild(wrapper);
    jest.clearAllMocks();
  });

  function renderComponent(props?: { isRemote?: boolean }) {
    const { isRemote = false } = props ?? {};
    root = createRoot(wrapper);

    root.render(
      <ThemeProvider isDark={false}>
        <SnackbarProvider>
          <MultiDropZoneListener
            allowedExtensions={[AllowedFileExtensions.FOXE, AllowedFileExtensions.MCAP]}
            isRemote={isRemote}
            onDrop={mockOnDrop}
          />
        </SnackbarProvider>
      </ThemeProvider>,
    );
  }

  describe("Given a MultiDropZoneListener component", () => {
    it("When rendering, Then should display file input", () => {
      // Given

      // When
      act(() => {
        renderComponent();
      });

      // Then
      const fileInput = document.querySelector('input[type="file"]')!;
      expect(fileInput).toBeTruthy();
      expect(fileInput).toHaveAttribute("data-puppeteer-file-upload");
      expect(fileInput).toHaveAttribute("multiple");
    });

    it("When files are selected via input, Then should call onDrop with local namespace", () => {
      // Given
      act(() => {
        renderComponent();
      });

      const fileInput = document.querySelector('input[type="file"]')!;
      const filename = `${BasicBuilder.string()}${AllowedFileExtensions.FOXE}`;
      const mockFile = new File([BasicBuilder.string()], filename, {
        type: "application/octet-stream",
      });

      // When
      Object.defineProperty(fileInput, "files", {
        value: [mockFile],
        writable: false,
      });

      act(() => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Then
      expect(mockOnDrop).toHaveBeenCalledWith({
        files: [mockFile],
        namespace: "local",
      });
    });
  });

  describe("onDragOver functionality", () => {
    it("When allowedExtensions is provided, Then should render file input correctly", () => {
      // Given
      act(() => {
        renderComponent();
      });

      // When
      // Then
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute("multiple");
    });

    it("When component has allowed extensions, Then should be ready to handle drag events", () => {
      // Given
      act(() => {
        renderComponent();
      });

      // When
      // Then
      expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    });
  });

  describe("onDrop functionality", () => {
    it("When component handles file drop via input, Then should call onDrop callback", () => {
      // Given
      act(() => {
        renderComponent();
      });

      const fileInput = document.querySelector('input[type="file"]')!;
      const filename = `test${AllowedFileExtensions.FOXE}`;
      const mockFile = new File([BasicBuilder.string()], filename);

      // When
      Object.defineProperty(fileInput, "files", {
        value: [mockFile],
        writable: false,
      });

      act(() => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      });

      // Then
      expect(mockOnDrop).toHaveBeenCalledWith({
        files: [mockFile],
        namespace: "local",
      });
    });

    it("When component is configured for remote, Then should render correctly", () => {
      // Given
      act(() => {
        renderComponent({ isRemote: true });
      });

      // When
      // Then
      expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
    });
  });

  describe("onDragLeave functionality", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("When component handles lifecycle events, Then should manage cleanup properly", () => {
      // Given
      act(() => {
        renderComponent();
      });

      // When
      // Then
      expect(document.querySelector('input[type="file"]')).toBeInTheDocument();

      // When
      act(() => {
        if (root != undefined) {
          root.unmount();
          root = undefined;
        }
      });

      // Then
      expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
    });

    it("When component is initialized, Then should setup event listeners", () => {
      // Given
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");
      const removeEventListenerSpy = jest.spyOn(document, "removeEventListener");

      // When
      act(() => {
        renderComponent();
      });

      // Then
      expect(addEventListenerSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith("drop", expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith("dragleave", expect.any(Function));

      // When
      act(() => {
        if (root != undefined) {
          root.unmount();
          root = undefined;
        }
      });

      // Then
      expect(removeEventListenerSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("drop", expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith("dragleave", expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});
