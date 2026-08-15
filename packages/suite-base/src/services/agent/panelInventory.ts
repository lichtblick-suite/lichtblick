// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { PanelInfo } from "@lichtblick/suite-base/context/PanelCatalogContext";
import { parseExtensionPanelsMeta } from "@lichtblick/suite-base/services/extension/utils/parseExtensionPanelsMeta";
import type {
  ExtensionInfo,
} from "@lichtblick/suite-base/types/Extensions";

export type PanelInventoryEntry = {
  type: string;
  title: string;
  description: string;
  source: "builtin" | "extension";
  schemas?: string[];
};

type ExtensionPanelMatch = {
  extension: ExtensionInfo;
  panelName: string;
};

function nonEmpty(value: string | undefined): string | undefined {
  return value == undefined || value.trim().length === 0
    ? undefined
    : value.trim();
}

function findExtensionPanel(
  panelType: string,
  extensions: readonly ExtensionInfo[],
): ExtensionPanelMatch | undefined {
  let match: ExtensionPanelMatch | undefined;
  let matchedPrefixLength = -1;
  for (const extension of extensions) {
    const prefix = `${extension.qualifiedName}.`;
    if (!panelType.startsWith(prefix) || panelType.length === prefix.length) {
      continue;
    }
    if (prefix.length > matchedPrefixLength) {
      matchedPrefixLength = prefix.length;
      match = { extension, panelName: panelType.slice(prefix.length) };
    }
  }
  return match;
}

/** Creates the serializable panel snapshot supplied to the local Agent each turn. */
export function buildPanelInventory(
  panels: readonly PanelInfo[],
  extensions: readonly ExtensionInfo[],
): PanelInventoryEntry[] {
  return panels.map((panel) => {
    const match = findExtensionPanel(panel.type, extensions);
    const metadata =
      match == undefined
        ? undefined
        : parseExtensionPanelsMeta(match.extension.panelsMeta)?.[
            match.panelName
          ];
    const description =
      nonEmpty(metadata?.description) ??
      nonEmpty(panel.description) ??
      nonEmpty(match?.extension.description) ??
      `${panel.title} panel.`;
    const schemas = metadata?.schemas?.filter((schema) => schema.length > 0);

    return {
      type: panel.type,
      title: panel.title,
      description,
      source: match == undefined ? "builtin" : "extension",
      ...(schemas == undefined || schemas.length === 0 ? {} : { schemas }),
    };
  });
}
