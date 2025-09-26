/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { SnackbarProvider } from "notistack";
import { act } from "react";
import { createRoot } from "react-dom/client";

import MultiDropZoneListener from "@lichtblick/suite-base/components/MultiDropZoneListener";
import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

describe("<MultiDropZoneListener>", () => {
  let wrapper: HTMLDivElement;
  let windowDragoverHandler: typeof jest.fn;
  let mockOnDrop: jest.Mock;

  beforeEach(() => {
    windowDragoverHandler = jest.fn();
    window.addEventListener("dragover", windowDragoverHandler);

    wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    mockOnDrop = jest.fn();
  });

  afterEach(() => {
    window.removeEventListener("dragover", windowDragoverHandler);
    document.body.removeChild(wrapper);
  });

  function renderComponent() {
    const root = createRoot(wrapper);

    root.render(
      <ThemeProvider isDark={false}>
        <SnackbarProvider>
          <MultiDropZoneListener
            allowedExtensions={[AllowedFileExtensions.FOXE]}
            isRemote={false}
            onDrop={mockOnDrop}
          />
        </SnackbarProvider>
      </ThemeProvider>,
    );
  }

  it("should render without crashing", () => {
    act(() => {
      renderComponent();
    });

    (console.error as jest.Mock).mockClear();

    const fileInput = document.querySelector('input[type="file"]')!;
    expect(fileInput).toBeTruthy();
    expect(fileInput).toHaveAttribute("data-puppeteer-file-upload");
  });

  it("should call onDrop with correct namespace when files are dropped via input", () => {
    act(() => {
      renderComponent();
    });

    (console.error as jest.Mock).mockClear();

    const fileInput = document.querySelector('input[type="file"]')!;

    // Simulate file selection (defaults to local namespace)
    const filename = `${BasicBuilder.string()}${AllowedFileExtensions.FOXE}`;
    const blob: BlobPart[] = [BasicBuilder.string()];
    const mockFile = new File(blob, filename, {
      type: "application/octet-stream",
    });
    Object.defineProperty(fileInput, "files", {
      value: [mockFile],
      writable: false,
    });

    act(() => {
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(mockOnDrop).toHaveBeenCalledWith({
      files: [mockFile],
      namespace: "local",
    });
  });
});
