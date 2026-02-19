// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useMemo } from "react";

import { MessagePathStructureItem } from "@lichtblick/message-path";
import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import { messagePathStructures } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { structureAllItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath";

import { useStructureItemsByPathStore } from "./useStructureItemsByPathStore";

type UseStructuredItemsByPathProps = {
  noMultiSlices?: boolean;
  validTypes?: readonly string[];
};

/**
 * Returns a map of all message path structure items, optionally filtered by `validTypes` and `noMultiSlices`.
 *
 * If both `validTypes` and `noMultiSlices` are `undefined`, this hook returns a precomputed cached map
 * from the global store (`useStructureItemsByPathStore`), which is populated by `useStructureItemsStoreManager`.
 * This avoids recomputing structure definitions unnecessarily, improving performance for common use cases.
 *
 * When either `validTypes` or `noMultiSlices` is provided, a custom computation is triggered based on the
 * current data source and filtering options. This allows components like `MessagePathInput` to dynamically
 * adjust their view while still benefiting from shared logic and optimization.
 */

export function useStructuredItemsByPath({
  noMultiSlices,
  validTypes,
}: UseStructuredItemsByPathProps): Map<string, MessagePathStructureItem> {
  const structureItemsByPath = useStructureItemsByPathStore((state) => state.structureItemsByPath);

  const { datatypes, topics } = PanelAPI.useDataSourceInfo();

  const messagePathStructuresForDataype = useMemo(
    () => messagePathStructures(datatypes),
    [datatypes],
  );

  const gettingAllStructureItemsByPath = useCallback(
    () =>
      structureAllItemsByPath({
        noMultiSlices,
        validTypes,
        messagePathStructuresForDataype,
        topics,
      }),
    [messagePathStructuresForDataype, noMultiSlices, topics, validTypes],
  );

  if (!validTypes && noMultiSlices == undefined) {
    return structureItemsByPath;
  }

  return gettingAllStructureItemsByPath();
}
