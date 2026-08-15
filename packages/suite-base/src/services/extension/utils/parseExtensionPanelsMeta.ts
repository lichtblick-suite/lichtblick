// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type {
  ExtensionPanelMetadata,
  ExtensionPanelsMetadata,
} from "@lichtblick/suite-base/types/Extensions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value != undefined && !Array.isArray(value)
  );
}

/** Reads the optional `lichtblickPanels` package field without trusting extension input. */
export function parseExtensionPanelsMeta(
  value: unknown,
): ExtensionPanelsMetadata | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const panelsMeta: ExtensionPanelsMetadata = {};
  for (const [panelName, candidate] of Object.entries(value)) {
    if (panelName.trim().length === 0 || !isRecord(candidate)) {
      continue;
    }

    const description =
      typeof candidate.description === "string" &&
      candidate.description.trim().length > 0
        ? candidate.description.trim()
        : undefined;
    const schemas =
      Array.isArray(candidate.schemas) &&
      candidate.schemas.every(
        (schema) => typeof schema === "string" && schema.trim().length > 0,
      )
        ? candidate.schemas.map((schema) => schema.trim())
        : undefined;
    const metadata: ExtensionPanelMetadata = {
      ...(description == undefined ? {} : { description }),
      ...(schemas == undefined ? {} : { schemas }),
    };
    if (metadata.description != undefined || metadata.schemas != undefined) {
      panelsMeta[panelName] = metadata;
    }
  }

  return Object.keys(panelsMeta).length === 0 ? undefined : panelsMeta;
}
