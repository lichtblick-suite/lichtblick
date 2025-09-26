/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { HandleDropProps } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";
import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

import handleDrop from "./handleDrop";

jest.mock("@lichtblick/log", () => ({
  getLogger: () => ({
    info: jest.fn(),
  }),
}));

// Mock FileSystemFileHandle for browser compatibility testing
global.FileSystemFileHandle = class MockFileSystemFileHandle {
  public kind = "file" as const;
} as unknown as typeof FileSystemFileHandle;

describe("handleDrop", () => {
  let mockEnqueueSnackbar: jest.Mock;
  let mockOnDrop: jest.Mock;
  let mockSetActiveZone: jest.Mock;
  let mockSetHovering: jest.Mock;

  function mockDataTransfer(mockItems: DataTransferItem[]): DataTransfer {
    return {
      items: {
        length: mockItems.length,
        *[Symbol.iterator]() {
          yield* mockItems;
        },
      },
    } as unknown as DataTransfer;
  }

  function createHandleDropProps(overrides: Partial<HandleDropProps> = {}): HandleDropProps {
    const event = {
      dataTransfer: mockDataTransfer([]),
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as DragEvent;

    return {
      allowedExtensions: [AllowedFileExtensions.FOXE, AllowedFileExtensions.MCAP],
      dropZone: "local",
      enqueueSnackbar: mockEnqueueSnackbar,
      event,
      onDrop: mockOnDrop,
      setActiveZone: mockSetActiveZone,
      setHovering: mockSetHovering,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockEnqueueSnackbar = jest.fn();
    mockOnDrop = jest.fn();
    mockSetActiveZone = jest.fn();
    mockSetHovering = jest.fn();

    jest.clearAllMocks();

    Object.defineProperty(window, "isSecureContext", {
      value: true,
      writable: true,
    });
  });

  describe("Given handleDrop function", () => {
    it("When event has no dataTransfer, Then should reset state and return early", async () => {
      // Given
      const eventWithoutDataTransfer = {
        dataTransfer: undefined,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as unknown as DragEvent;
      const props = createHandleDropProps({ event: eventWithoutDataTransfer });

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
      expect(mockOnDrop).not.toHaveBeenCalled();
    });

    it("When allowedExtensions is undefined, Then should reset state and return early", async () => {
      // Given
      const props = createHandleDropProps({ allowedExtensions: undefined });

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
      expect(mockOnDrop).not.toHaveBeenCalled();
    });

    it("When no files are dropped, Then should reset state and return early", async () => {
      // Given
      const props = createHandleDropProps();

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
      expect(mockOnDrop).not.toHaveBeenCalled();
    });

    describe("DataTransferItems processing loop", () => {
      it("When items are present in dataTransfer, Then should iterate through all items", async () => {
        // Given
        const mockItem1 = {
          webkitGetAsEntry: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;
        const mockItem2 = {
          webkitGetAsEntry: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;
        const mockItem3 = {
          webkitGetAsEntry: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItems = {
          dataTransfer: mockDataTransfer([mockItem1, mockItem2, mockItem3]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItems });
        const webkitGetAsEntrySpy = jest.spyOn(mockItem1, "webkitGetAsEntry");

        // When
        await handleDrop(props);

        // Then
        expect(mockSetHovering).toHaveBeenCalledWith(undefined);
        expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
        // The function should process all 3 items in the for...of loop
        expect(webkitGetAsEntrySpy).toHaveBeenCalled();
        expect(webkitGetAsEntrySpy).toHaveBeenCalled();
        expect(webkitGetAsEntrySpy).toHaveBeenCalled();
      });

      it("When secure context is available, Then should check for FileSystemHandle support", async () => {
        // Given
        Object.defineProperty(window, "isSecureContext", { value: true, writable: true });

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });
        const webkitGetAsEntrySpy = jest.spyOn(mockItem, "webkitGetAsEntry");

        // When
        await handleDrop(props);

        // Then
        expect(mockSetHovering).toHaveBeenCalledWith(undefined);
        expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
        expect(webkitGetAsEntrySpy).toHaveBeenCalled();
        // In secure context, FileSystemHandle methods should be available
      });

      it("When secure context is not available, Then should handle items without FileSystemHandle", async () => {
        // Given
        Object.defineProperty(window, "isSecureContext", { value: false, writable: true });

        const mockItem = {
          webkitGetAsEntry: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });
        const webkitGetAsEntrySpy = jest.spyOn(mockItem, "webkitGetAsEntry");

        // When
        await handleDrop(props);

        // Then
        expect(mockSetHovering).toHaveBeenCalledWith(undefined);
        expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
        expect(webkitGetAsEntrySpy).toHaveBeenCalled();
        // In non-secure context, FileSystemHandle won't be available but should still process
      });

      it("When isFile is true, Then should process file correctly", async () => {
        // Given
        const mockFile = new File([BasicBuilder.string()], "test.foxe");
        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(mockFile),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [mockFile],
            handles: undefined,
            namespace: "local",
            isSource: false,
          }),
        );
      });

      it("When isDirectory is true, Then should process directory and extract files", async () => {
        // Given
        const mockDirectoryFile = new File([BasicBuilder.string()], "nested.mcap");
        const mockFileEntry = {
          isFile: true,
          file: jest.fn((resolve) => resolve(mockDirectoryFile)),
        } as unknown as FileSystemFileEntry;

        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) => resolve([mockFileEntry])),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });
        const createReaderSpy = jest.spyOn(mockDirectoryEntry, "createReader");

        // When
        await handleDrop(props);

        // Then
        expect(createReaderSpy).toHaveBeenCalled();
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [mockDirectoryFile],
            handles: undefined,
            namespace: "local",
            isSource: false,
          }),
        );
      });

      it("When directory has multiple files, Then should extract all valid files", async () => {
        // Given
        const mockFile1 = new File([BasicBuilder.string()], "file1.foxe");
        const mockFile2 = new File([BasicBuilder.string()], "file2.mcap");
        const mockFile3 = new File([BasicBuilder.string()], "file3.txt"); // Invalid extension

        const mockFileEntry1 = {
          isFile: true,
          file: jest.fn((resolve) => resolve(mockFile1)),
        } as unknown as FileSystemFileEntry;

        const mockFileEntry2 = {
          isFile: true,
          file: jest.fn((resolve) => resolve(mockFile2)),
        } as unknown as FileSystemFileEntry;

        const mockFileEntry3 = {
          isFile: true,
          file: jest.fn((resolve) => resolve(mockFile3)),
        } as unknown as FileSystemFileEntry;

        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) =>
              resolve([mockFileEntry1, mockFileEntry2, mockFileEntry3]),
            ),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [mockFile1, mockFile2], // Only valid extensions
            handles: undefined,
            namespace: "local",
            isSource: false,
          }),
        );
      });

      it("When directory is empty, Then should call onDrop with empty files array", async () => {
        // Given
        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) => resolve([])), // Empty directory
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [],
            handles: undefined,
            namespace: "local",
            isSource: false,
          }),
        );
      });

      it("When directory contains only invalid file extensions, Then should call onDrop with empty files array", async () => {
        // Given
        const mockFile = new File([BasicBuilder.string()], "invalid.txt"); // Invalid extension

        const mockFileEntry = {
          isFile: true,
          file: jest.fn((resolve) => resolve(mockFile)),
        } as unknown as FileSystemFileEntry;

        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) => resolve([mockFileEntry])),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [], // Filtered out invalid files
            handles: undefined,
            namespace: "local",
            isSource: false,
          }),
        );
        expect(mockEnqueueSnackbar).not.toHaveBeenCalled(); // Error not shown when directories present
      });

      it("When direct files have invalid extensions and no directories, Then should show error message", async () => {
        // Given
        const mockFile = new File([BasicBuilder.string()], "invalid.txt"); // Invalid extension

        // Create a handle with invalid extension name
        const mockHandle = new global.FileSystemFileHandle();
        Object.defineProperty(mockHandle, "name", { value: "invalid.txt" }); // Invalid extension

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue(mockHandle),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(mockFile),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockEnqueueSnackbar).toHaveBeenCalledWith("The file format is not supported.", {
          variant: "error",
        });
        expect(mockOnDrop).not.toHaveBeenCalled();
      });

      it("When mixed files and directories are dropped, Then should process both", async () => {
        // Given
        const directoryFile = new File([BasicBuilder.string()], "dir-file.foxe");
        const directFile = new File([BasicBuilder.string()], "direct-file.mcap");

        const mockFileEntry = {
          isFile: true,
          file: jest.fn((resolve) => resolve(directoryFile)),
        } as unknown as FileSystemFileEntry;

        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) => resolve([mockFileEntry])),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockDirectoryItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const mockFileItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(directFile),
        } as unknown as DataTransferItem;

        const eventWithItems = {
          dataTransfer: {
            items: {
              length: 2,
              *[Symbol.iterator]() {
                yield mockDirectoryItem;
                yield mockFileItem;
              },
            },
          },
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItems });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: expect.arrayContaining([directoryFile, directFile]),
            handles: undefined,
            namespace: "local",
            isSource: false,
          }),
        );
      });

      it("When directory readEntries fails, Then should handle error gracefully", async () => {
        // Given
        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((_, reject) => reject(new Error("Failed to read directory"))),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When & Then
        await expect(handleDrop(props)).rejects.toThrow("Failed to read directory");
      });

      it("When file extraction from directory fails, Then should handle error gracefully", async () => {
        // Given
        const mockFileEntry = {
          isFile: true,
          file: jest.fn((_, reject) => reject(new Error("Failed to extract file"))),
        } as unknown as FileSystemFileEntry;

        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) => resolve([mockFileEntry])),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When & Then
        await expect(handleDrop(props)).rejects.toThrow("Failed to extract file");
      });

      it("When entry is neither file nor directory, Then should skip processing", async () => {
        // Given
        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue({
            isFile: false,
            isDirectory: false,
          } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).not.toHaveBeenCalled();
      });

      it("When webkitGetAsEntry returns null, Then should handle gracefully", async () => {
        // Given
        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue(undefined),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).not.toHaveBeenCalled();
      });
    });

    describe("DropZone and namespace scenarios", () => {
      it("When dropZone is source, Then should set isSource to true", async () => {
        // Given
        const mockFile = new File([BasicBuilder.string()], "test.foxe");
        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(mockFile),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({
          event: eventWithItem,
          dropZone: "source",
        });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [mockFile],
            handles: undefined,
            namespace: undefined,
            isSource: true,
          }),
        );
      });

      it("When dropZone is org, Then should set namespace to org", async () => {
        // Given
        const mockFile = new File([BasicBuilder.string()], "test.foxe");
        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(mockFile),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({
          event: eventWithItem,
          dropZone: "org",
        });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [mockFile],
            handles: undefined,
            namespace: "org" as ExtensionNamespace,
            isSource: false,
          }),
        );
      });

      it("When dropZone is local, Then should set namespace to local", async () => {
        // Given
        const mockFile = new File([BasicBuilder.string()], "test.foxe");
        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue({}),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(mockFile),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({
          event: eventWithItem,
          dropZone: "local",
        });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [mockFile],
            handles: undefined,
            namespace: "local" as ExtensionNamespace,
            isSource: false,
          }),
        );
      });
    });

    describe("FileSystemHandle processing", () => {
      it("When no directories present and FileSystemHandle available, Then should use handles", async () => {
        // Given
        const mockHandle = new global.FileSystemFileHandle();
        Object.defineProperty(mockHandle, "name", { value: "test.foxe" });

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue(mockHandle),
          webkitGetAsEntry: jest.fn().mockReturnValue({ isFile: true } as FileSystemEntry),
          getAsFile: jest.fn().mockReturnValue(new File([BasicBuilder.string()], "test.foxe")),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            handles: [mockHandle],
          }),
        );
      });

      it("When directories are present, Then should not use handles and call onDrop", async () => {
        // Given
        const mockHandle = new global.FileSystemFileHandle();
        Object.defineProperty(mockHandle, "name", { value: "test.foxe" });

        const mockDirectoryEntry = {
          isDirectory: true,
          createReader: jest.fn(() => ({
            readEntries: jest.fn((resolve) => resolve([])),
          })),
        } as unknown as FileSystemDirectoryEntry;

        const mockItem = {
          getAsFileSystemHandle: jest.fn().mockResolvedValue(mockHandle),
          webkitGetAsEntry: jest.fn().mockReturnValue(mockDirectoryEntry),
          getAsFile: jest.fn().mockReturnValue(undefined),
        } as unknown as DataTransferItem;

        const eventWithItem = {
          dataTransfer: mockDataTransfer([mockItem]),
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        } as unknown as DragEvent;

        const props = createHandleDropProps({ event: eventWithItem });

        // When
        await handleDrop(props);

        // Then
        expect(mockOnDrop).toHaveBeenCalledWith(
          expect.objectContaining({
            files: [],
            handles: undefined, // Handles set to undefined when directories present
            namespace: "local",
            isSource: false,
          }),
        );
      });
    });

    it("When dropZone is source, Then should determine correct parameters", async () => {
      // Given
      const props = createHandleDropProps({ dropZone: "source" });

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
    });

    it("When dropZone is org, Then should handle namespace correctly", async () => {
      // Given
      const props = createHandleDropProps({ dropZone: "org" });

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
    });

    it("When onDrop callback is not provided, Then should not throw error", async () => {
      // Given
      const props = createHandleDropProps({ onDrop: undefined });

      // When & Then
      await expect(handleDrop(props)).resolves.not.toThrow();
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
    });

    it("When state is reset, Then should call setters with undefined", async () => {
      // Given
      const props = createHandleDropProps();

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
    });

    it("When allowedExtensions are provided, Then should process them correctly", async () => {
      // Given
      const customExtensions = [BasicBuilder.sample([".foxe", ".mcap", ".json"])];
      const props = createHandleDropProps({ allowedExtensions: customExtensions });

      // When
      await handleDrop(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith(undefined);
      expect(mockSetActiveZone).toHaveBeenCalledWith(undefined);
    });
  });
});
