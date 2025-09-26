// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  DragPosition,
  DropZoneConfig,
  DropZoneType,
  WindowDimensions,
} from "@lichtblick/suite-base/components/MultiDropZoneListener/types";

/**
 * Determines which drop zone should be active based on drag position and configuration
 */
export function determineActiveDropZone(
  position: DragPosition,
  windowDimensions: WindowDimensions,
  config: DropZoneConfig,
): DropZoneType {
  const { clientX, clientY } = position;
  const { width, height } = windowDimensions;
  const { isRemote, topSectionRatio } = config;

  const topSectionHeight = height * topSectionRatio;

  if (clientY < topSectionHeight) {
    // Top section - extensions
    if (isRemote) {
      // When remote: left/right split for local/org extensions
      const isLeftSide = clientX < width / 2;
      return isLeftSide ? "local" : "org";
    } else {
      // When not remote: entire top section is local extensions
      return "local";
    }
  } else {
    // Bottom section - data sources (always available)
    return "source";
  }
}

/**
 * Validates if drag event should be handled based on data transfer types
 */
export function shouldHandleDragEvent(dataTransfer: DataTransfer | undefined): boolean {
  return dataTransfer?.types.includes("Files") === true;
}

/**
 * Prepares drag event for handling (prevents default, sets drop effect)
 */
export function prepareDragEvent(ev: DragEvent, dataTransfer: DataTransfer): void {
  ev.stopPropagation();
  ev.preventDefault();
  dataTransfer.dropEffect = "copy";
}
