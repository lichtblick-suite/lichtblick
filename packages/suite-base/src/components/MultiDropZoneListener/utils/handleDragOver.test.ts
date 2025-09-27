/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { AllowedFileExtensions } from "@lichtblick/suite-base/constants/allowedFileExtensions";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { determineActiveDropZone, prepareDragEvent, shouldHandleDragEvent } from "./dropZone";
import handleDragOver, { HandleDragOverProps } from "./handleDragOver";

// Mock the utility functions
jest.mock("./dropZone", () => ({
  shouldHandleDragEvent: jest.fn(),
  prepareDragEvent: jest.fn(),
  determineActiveDropZone: jest.fn(),
}));

describe("handleDragOver", () => {
  let mockSetActiveZone: jest.Mock;
  let mockSetHovering: jest.Mock;
  let mockDragLeaveTimeoutRef: React.MutableRefObject<NodeJS.Timeout | undefined>;
  let mockEvent: DragEvent;
  let mockDataTransfer: DataTransfer;

  beforeEach(() => {
    mockSetActiveZone = jest.fn();
    mockSetHovering = jest.fn();
    mockDragLeaveTimeoutRef = { current: undefined };

    mockDataTransfer = {
      types: ["Files"],
      dropEffect: "none",
    } as unknown as DataTransfer;

    mockEvent = {
      clientX: BasicBuilder.number({ min: 0, max: 1000 }),
      clientY: BasicBuilder.number({ min: 0, max: 600 }),
      dataTransfer: mockDataTransfer,
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as DragEvent;

    // Reset mocks
    (shouldHandleDragEvent as jest.Mock).mockReset();
    (prepareDragEvent as jest.Mock).mockReset();
    (determineActiveDropZone as jest.Mock).mockReset();

    jest.clearAllMocks();
  });

  function createHandleDragOverProps(
    overrides: Partial<HandleDragOverProps> = {},
  ): HandleDragOverProps {
    return {
      allowedExtensions: [AllowedFileExtensions.FOXE, AllowedFileExtensions.MCAP],
      dragLeaveTimeoutRef: mockDragLeaveTimeoutRef,
      event: mockEvent,
      hovering: undefined,
      isRemote: false,
      setActiveZone: mockSetActiveZone,
      setHovering: mockSetHovering,
      ...overrides,
    };
  }

  describe("Given handleDragOver function", () => {
    it("When allowedExtensions is undefined, Then should return early without processing", () => {
      // Given
      const props = createHandleDragOverProps({ allowedExtensions: undefined });

      // When
      handleDragOver(props);

      // Then
      expect(shouldHandleDragEvent).not.toHaveBeenCalled();
      expect(mockSetActiveZone).not.toHaveBeenCalled();
      expect(mockSetHovering).not.toHaveBeenCalled();
    });

    it("When drag event should not be handled, Then should return early", () => {
      // Given
      const props = createHandleDragOverProps();
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(false);

      // When
      handleDragOver(props);

      // Then
      expect(shouldHandleDragEvent).toHaveBeenCalledWith(mockDataTransfer);
      expect(prepareDragEvent).not.toHaveBeenCalled();
      expect(mockSetActiveZone).not.toHaveBeenCalled();
    });

    it("When drag event is valid and hovering is undefined, Then should set hovering to local", () => {
      // Given
      const props = createHandleDragOverProps({ hovering: undefined });
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(true);
      (determineActiveDropZone as jest.Mock).mockReturnValue("local");

      // When
      handleDragOver(props);

      // Then
      expect(mockSetHovering).toHaveBeenCalledWith("local");
    });

    it("When drag event is valid and hovering is already set, Then should not update hovering", () => {
      // Given
      const props = createHandleDragOverProps({ hovering: "org" });
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(true);
      (determineActiveDropZone as jest.Mock).mockReturnValue("source");

      // When
      handleDragOver(props);

      // Then
      expect(mockSetHovering).not.toHaveBeenCalled();
    });

    it("When dragLeave timeout exists, Then should clear timeout", () => {
      // Given
      const mockTimeout = BasicBuilder.number() as unknown as NodeJS.Timeout;
      mockDragLeaveTimeoutRef.current = mockTimeout;
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      const props = createHandleDragOverProps();
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(true);
      (determineActiveDropZone as jest.Mock).mockReturnValue("local");

      // When
      handleDragOver(props);

      // Then
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockTimeout);
      expect(mockDragLeaveTimeoutRef.current).toBeUndefined();

      clearTimeoutSpy.mockRestore();
    });

    it("When drag event is processed, Then should call prepareDragEvent with correct parameters", () => {
      // Given
      const props = createHandleDragOverProps();
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(true);
      (determineActiveDropZone as jest.Mock).mockReturnValue("local");

      // When
      handleDragOver(props);

      // Then
      expect(prepareDragEvent).toHaveBeenCalledWith(mockEvent, mockDataTransfer);
    });

    it("When determining active zone, Then should pass correct parameters to determineActiveDropZone", () => {
      // Given
      const props = createHandleDragOverProps({ isRemote: true });
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(true);
      (determineActiveDropZone as jest.Mock).mockReturnValue("org");

      // When
      handleDragOver(props);

      // Then
      expect(determineActiveDropZone).toHaveBeenCalledWith(
        { clientX: mockEvent.clientX, clientY: mockEvent.clientY },
        { width: window.innerWidth, height: window.innerHeight },
        { isRemote: true, topSectionRatio: 0.5 },
      );
    });

    it("When active zone is determined, Then should set the new active zone", () => {
      // Given
      const expectedZone = BasicBuilder.sample(["local", "org", "source"]);
      const props = createHandleDragOverProps();
      (shouldHandleDragEvent as jest.Mock).mockReturnValue(true);
      (determineActiveDropZone as jest.Mock).mockReturnValue(expectedZone);

      // When
      handleDragOver(props);

      // Then
      expect(mockSetActiveZone).toHaveBeenCalledWith(expectedZone);
    });

    it("When event has no dataTransfer, Then should return early", () => {
      // Given
      const eventWithoutDataTransfer = {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        ...mockEvent,
        dataTransfer: ReactNull,
      } as unknown as DragEvent;
      const props = createHandleDragOverProps({ event: eventWithoutDataTransfer });

      // When
      handleDragOver(props);

      // Then
      expect(shouldHandleDragEvent).toHaveBeenCalledWith(undefined);
      expect(prepareDragEvent).not.toHaveBeenCalled();
    });
  });
});
