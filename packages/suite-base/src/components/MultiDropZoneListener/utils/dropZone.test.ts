/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  DragPosition,
  DropZoneConfig,
  WindowDimensions,
} from "@lichtblick/suite-base/components/MultiDropZoneListener/types";

import { determineActiveDropZone, shouldHandleDragEvent, prepareDragEvent } from "./dropZone";

describe("dropZone", () => {
  describe("determineActiveDropZone", () => {
    const windowDimensions: WindowDimensions = {
      width: 1000,
      height: 800,
    };

    const baseConfig: DropZoneConfig = {
      isRemote: false,
      topSectionRatio: 0.55,
    };

    describe("Given standard window dimensions and configuration", () => {
      it("When drag position is in top section and isRemote is false, Then should return local", () => {
        // Given
        const position: DragPosition = { clientX: 500, clientY: 200 }; // Top section (< 440)
        const config = { ...baseConfig, isRemote: false };

        // When
        const result = determineActiveDropZone(position, windowDimensions, config);

        // Then
        expect(result).toBe("local");
      });

      it("When drag position is in bottom section, Then should return source", () => {
        // Given
        const position: DragPosition = { clientX: 500, clientY: 600 }; // Bottom section (> 440)
        const config = baseConfig;

        // When
        const result = determineActiveDropZone(position, windowDimensions, config);

        // Then
        expect(result).toBe("source");
      });

      it("When drag position is in top-left and isRemote is true, Then should return local", () => {
        // Given
        const position: DragPosition = { clientX: 300, clientY: 200 }; // Top-left (< 500)
        const config = { ...baseConfig, isRemote: true };

        // When
        const result = determineActiveDropZone(position, windowDimensions, config);

        // Then
        expect(result).toBe("local");
      });

      it("When drag position is in top-right and isRemote is true, Then should return org", () => {
        // Given
        const position: DragPosition = { clientX: 700, clientY: 200 }; // Top-right (> 500)
        const config = { ...baseConfig, isRemote: true };

        // When
        const result = determineActiveDropZone(position, windowDimensions, config);

        // Then
        expect(result).toBe("org");
      });

      it("When drag position is exactly at top section boundary, Then should return local for non-remote", () => {
        // Given
        const topSectionHeight = windowDimensions.height * baseConfig.topSectionRatio;
        const position: DragPosition = { clientX: 500, clientY: topSectionHeight - 1 };
        const config = { ...baseConfig, isRemote: false };

        // When
        const result = determineActiveDropZone(position, windowDimensions, config);

        // Then
        expect(result).toBe("local");
      });

      it("When drag position is exactly at horizontal boundary for remote mode, Then should return local", () => {
        // Given
        const position: DragPosition = { clientX: windowDimensions.width / 2 - 1, clientY: 200 };
        const config = { ...baseConfig, isRemote: true };

        // When
        const result = determineActiveDropZone(position, windowDimensions, config);

        // Then
        expect(result).toBe("local");
      });
    });

    describe("Given different topSectionRatio values", () => {
      it("When topSectionRatio is 0.3, Then should adjust section boundaries correctly", () => {
        // Given
        const config = { ...baseConfig, topSectionRatio: 0.3 };
        const topBoundary = windowDimensions.height * 0.3; // 240px
        const positionInTop: DragPosition = { clientX: 500, clientY: topBoundary - 1 };
        const positionInBottom: DragPosition = { clientX: 500, clientY: topBoundary + 1 };

        // When
        const topResult = determineActiveDropZone(positionInTop, windowDimensions, config);
        const bottomResult = determineActiveDropZone(positionInBottom, windowDimensions, config);

        // Then
        expect(topResult).toBe("local");
        expect(bottomResult).toBe("source");
      });
    });
  });

  describe("shouldHandleDragEvent", () => {
    describe("Given DataTransfer objects with different types", () => {
      it("When dataTransfer contains Files type, Then should return true", () => {
        // Given
        const mockDataTransfer = {
          types: ["Files", "text/plain"],
        } as unknown as DataTransfer;

        // When
        const result = shouldHandleDragEvent(mockDataTransfer);

        // Then
        expect(result).toBe(true);
      });

      it("When dataTransfer does not contain Files type, Then should return false", () => {
        // Given
        const mockDataTransfer = {
          types: ["text/plain", "text/html"],
        } as unknown as DataTransfer;

        // When
        const result = shouldHandleDragEvent(mockDataTransfer);

        // Then
        expect(result).toBe(false);
      });

      it("When dataTransfer is undefined, Then should return false", () => {
        // Given
        const dataTransfer = undefined;

        // When
        const result = shouldHandleDragEvent(dataTransfer);

        // Then
        expect(result).toBe(false);
      });

      it("When dataTransfer has empty types array, Then should return false", () => {
        // Given
        const mockDataTransfer = {
          types: [],
        } as unknown as DataTransfer;

        // When
        const result = shouldHandleDragEvent(mockDataTransfer);

        // Then
        expect(result).toBe(false);
      });
    });
  });

  describe("prepareDragEvent", () => {
    describe("Given drag event and dataTransfer objects", () => {
      it("When preparing drag event, Then should set correct properties", () => {
        // Given
        const stopPropagationSpy = jest.fn();
        const preventDefaultSpy = jest.fn();
        const mockEvent = {
          stopPropagation: stopPropagationSpy,
          preventDefault: preventDefaultSpy,
        } as unknown as DragEvent;

        const mockDataTransfer = {
          dropEffect: "none",
        } as DataTransfer;

        // When
        prepareDragEvent(mockEvent, mockDataTransfer);

        // Then
        expect(stopPropagationSpy).toHaveBeenCalled();
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(mockDataTransfer.dropEffect).toBe("copy");
      });

      it("When preparing drag event, Then should call event methods exactly once", () => {
        // Given
        const stopPropagationSpy = jest.fn();
        const preventDefaultSpy = jest.fn();
        const mockEvent = {
          stopPropagation: stopPropagationSpy,
          preventDefault: preventDefaultSpy,
        } as unknown as DragEvent;

        const mockDataTransfer = {
          dropEffect: "move",
        } as DataTransfer;

        // When
        prepareDragEvent(mockEvent, mockDataTransfer);

        // Then
        expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
        expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
        expect(mockDataTransfer.dropEffect).toBe("copy");
      });
    });
  });
});
