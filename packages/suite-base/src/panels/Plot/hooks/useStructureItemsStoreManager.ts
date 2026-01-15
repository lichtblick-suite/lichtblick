// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo } from "react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import { messagePathStructures } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { structureAllItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath";
import { useStructureItemsByPathStore } from "@lichtblick/suite-base/components/MessagePathSyntax/useStructureItemsByPathStore";

/**
 * Precomputes and caches all structure items by message path, based on the current data source (topics and datatypes).
 *
 * This hook is intended to be used once at the top level of the application (e.g. in `Workspace.tsx`)
 * to avoid recalculating message path structures multiple times across the UI. The calculation is
 * moderately expensive, but in most use cases, it depends only on the `topics` and `datatypes`
 * from the data source — not on user-specific filters.
 *
 * The result is stored in a global Zustand store (`useStructureItemsByPathStore`) and can be reused
 * throughout the application via `useStructuredItemsByPath`, which checks whether any extra filtering
 * (`validTypes`, `noMultiSlices`) is needed before using the cached version.
 *
 * This ensures performance and consistency, especially for components like `MessagePathInput`,
 * which may otherwise trigger unnecessary recomputations.
 *
 * Only re-runs when `topics` or `datatypes` change, which typically only happens when a new MCAP is loaded.
 */
export function useStructureItemsStoreManager(): void {
  const setStructureItemsByPath = useStructureItemsByPathStore(
    (state) => state.setStructureItemsByPath,
  );
  const { datatypes, topics } = PanelAPI.useDataSourceInfo();

  const messagePathStructuresForDataype = useMemo(
    () => messagePathStructures(datatypes),
    [datatypes],
  );

  useEffect(() => {
    const list = structureAllItemsByPath({ messagePathStructuresForDataype, topics });
    setStructureItemsByPath(list);
  }, [topics, messagePathStructuresForDataype, setStructureItemsByPath]);
}
