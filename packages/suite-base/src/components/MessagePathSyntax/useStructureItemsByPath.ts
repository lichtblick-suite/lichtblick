// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useMemo } from "react";

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
 * When either `validTypes` or `noMultiSlices` is provided, the map is computed for the current data source
 * and filtering options. The result is memoized across renders so that consumers such as `MessagePathInput`
 * (whose autocomplete re-renders on every keystroke) do not rebuild the entire structure map on each render.
 *
 * `validTypes` is tracked via a content-based key so that an unstable array reference — for example an
 * extension-provided `SettingsTreeFieldMessagePath.validTypes` that a settings tree rebuilds every render —
 * does not needlessly invalidate the memo.
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

  const validTypesKey = validTypes?.join(",");

  const computedItemsByPath = useMemo(() => {
    if (!validTypes && noMultiSlices == undefined) {
      return undefined;
    }
    return structureAllItemsByPath({
      noMultiSlices,
      validTypes,
      messagePathStructuresForDataype,
      topics,
    });
    // `validTypes` is intentionally tracked via the content-based `validTypesKey`
    // to avoid invalidating the memo on unstable array references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagePathStructuresForDataype, noMultiSlices, topics, validTypesKey]);

  return computedItemsByPath ?? structureItemsByPath;
}
