// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  DATA_SOURCE_FILES,
  LAYOUT_AND_EXTENSION_FILES,
} from "@lichtblick/suite-base/components/MultiDropZoneListener/constants";
import { DropZoneType } from "@lichtblick/suite-base/components/MultiDropZoneListener/types";

interface DropZoneInfo {
  description: string;
  allowedExtensions: string[];
}

export function generateDropZoneHelpMessage(dropZone: DropZoneType): string {
  let info: DropZoneInfo;
  if (dropZone === "local") {
    info = {
      description: "Drop extension files or layout configurations for local use",
      allowedExtensions: LAYOUT_AND_EXTENSION_FILES,
    };
  } else if (dropZone === "org") {
    info = {
      description: "Drop extension files or layout configurations for organization-wide use",
      allowedExtensions: LAYOUT_AND_EXTENSION_FILES,
    };
  } else {
    info = {
      description: "Drop data files to analyze and visualize",
      allowedExtensions: DATA_SOURCE_FILES,
    };
  }

  return `${info.description}. Supported formats: ${info.allowedExtensions.join(", ")}.`;
}
