// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

export function useStructuredItemsByPath({
  noMultiSlices,
  validTypes,
}: UseStructuredItemsByPathProps): Map<string, MessagePathStructureItem> {
  const allStructureItemsByPath = useStructureItemsByPathStore(
    (state) => state.allStructureItemsByPath,
  );

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
    return allStructureItemsByPath;
  }

  return gettingAllStructureItemsByPath();
}
