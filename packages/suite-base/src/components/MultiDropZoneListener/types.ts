// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ExtensionNamespace } from "@lichtblick/suite-base/types/Extensions";

export type MultiDropZoneListenerProps = {
  allowedExtensions?: string[];
  isRemote: boolean;
  onDrop?: (event: {
    files?: File[];
    handles?: FileSystemFileHandle[];
    namespace?: ExtensionNamespace;
    isSource?: boolean;
  }) => void;
};

export type HandleDropProps = {
  allowedExtensions?: string[];
  dropZone: DropZoneType;
  enqueueSnackbar: (message: string, options?: { variant: "error" }) => string | number | undefined;
  event: DragEvent;
  onDrop?: (event: {
    files?: File[];
    handles?: FileSystemFileHandle[];
    namespace?: ExtensionNamespace;
    isSource?: boolean;
  }) => void;
  setActiveZone: (zone: DropZoneType | undefined) => void;
  setHovering: (zone: DropZoneType | undefined) => void;
};

export type DropZoneType = ExtensionNamespace | "source";

export interface DragPosition {
  clientX: number;
  clientY: number;
}

export interface WindowDimensions {
  width: number;
  height: number;
}

export interface DropZoneConfig {
  isRemote: boolean;
  topSectionRatio: number; // Percentage of screen height for top section (0.0-1.0)
}
