// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { extname } from "path";

import {
  DATA_SOURCE_FILES,
  LAYOUT_AND_EXTENSION_FILES,
} from "@lichtblick/suite-base/components/MultiDropZoneListener/constants";
import { DropZoneType } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";

export interface ValidationResult {
  errorMessage?: string;
  invalidFiles: File[];
  isValid: boolean;
  validFiles: File[];
}

export interface UnifiedValidationResult {
  errorMessage?: string;
  invalidFiles: File[];
  invalidHandles: FileSystemFileHandle[];
  isValid: boolean;
  validFiles: File[];
  validHandles: FileSystemFileHandle[];
}

/**
 * Validates both files and handles together based on drop zone rules
 * This is the main validation function that handles all scenarios
 */
export function validateDropZoneItems(
  files: File[],
  handles: FileSystemFileHandle[] | undefined,
  dropZone: DropZoneType,
): UnifiedValidationResult {
  const validFiles: File[] = [];
  const invalidFiles: File[] = [];
  const validHandles: FileSystemFileHandle[] = [];
  const invalidHandles: FileSystemFileHandle[] = [];
  const errorMessages: string[] = [];
  const seenErrors = new Set<string>();

  let allowedExtensions: string[];
  let zoneDescription: string;

  switch (dropZone) {
    case "local":
      allowedExtensions = LAYOUT_AND_EXTENSION_FILES;
      zoneDescription = "Local Extensions or Layouts";
      break;
    case "org":
      allowedExtensions = LAYOUT_AND_EXTENSION_FILES;
      zoneDescription = "Organization Extensions or Layouts";
      break;
    case "source":
      allowedExtensions = DATA_SOURCE_FILES;
      zoneDescription = "Data Sources";
      break;
    default:
      return {
        isValid: false,
        validFiles: [],
        validHandles: [],
        invalidFiles: files,
        invalidHandles: handles ?? [],
        errorMessage: "Unknown drop zone",
      };
  }

  const itemsByName = new Map<string, { files: File[]; handles: FileSystemFileHandle[] }>();

  for (const file of files) {
    if (!itemsByName.has(file.name)) {
      itemsByName.set(file.name, { files: [], handles: [] });
    }
    itemsByName.get(file.name)!.files.push(file);
  }

  for (const handle of handles ?? []) {
    if (!itemsByName.has(handle.name)) {
      itemsByName.set(handle.name, { files: [], handles: [] });
    }
    itemsByName.get(handle.name)!.handles.push(handle);
  }

  for (const [fileName, items] of itemsByName) {
    const fileExtension = extname(fileName);
    const isValidExtension = allowedExtensions.includes(fileExtension);

    if (!isValidExtension) {
      invalidFiles.push(...items.files);
      invalidHandles.push(...items.handles);

      const errorMessage = `File extension "${fileExtension}" is not allowed in ${zoneDescription}. Allowed files: ${allowedExtensions.join(", ")}`;
      if (!seenErrors.has(errorMessage)) {
        errorMessages.push(errorMessage);
        seenErrors.add(errorMessage);
      }
      continue;
    }

    validFiles.push(...items.files);
    validHandles.push(...items.handles);
  }

  let errorMessage: string | undefined;

  if (errorMessages.length === 1) {
    errorMessage = errorMessages[0];
  } else if (errorMessages.length > 1) {
    const invalidNames = Array.from(
      new Set([
        ...invalidFiles.map((file) => file.name),
        ...invalidHandles.map((handle) => handle.name),
      ]),
    );
    errorMessage = `${invalidNames.length} files are not valid for ${zoneDescription}: ${invalidNames.join(", ")}`;
  }

  return {
    isValid: invalidFiles.length === 0 && invalidHandles.length === 0,
    validFiles,
    validHandles,
    invalidFiles,
    invalidHandles,
    errorMessage,
  };
}
