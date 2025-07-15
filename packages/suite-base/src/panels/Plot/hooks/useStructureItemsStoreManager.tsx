// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

//this hook is to manage

import { useEffect, useMemo } from "react";

import * as PanelAPI from "@lichtblick/suite-base/PanelAPI";
import { messagePathStructures } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { structureAllItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/structureAllItemsByPath";
import { useStructureItemsByPathStore } from "@lichtblick/suite-base/components/MessagePathSyntax/useStructureItemsByPathStore";

export function useStructureItemsStoreManager(): void {
  const setAllStructureItemsByPath = useStructureItemsByPathStore(
    (state) => state.setAllStructureItemsByPath,
  );
  const { datatypes, topics } = PanelAPI.useDataSourceInfo();

  const messagePathStructuresForDataype = useMemo(
    () => messagePathStructures(datatypes),
    [datatypes],
  );

  useEffect(() => {
    const list = structureAllItemsByPath({ messagePathStructuresForDataype, topics });
    setAllStructureItemsByPath(list);
  }, [topics, messagePathStructuresForDataype, setAllStructureItemsByPath]);
}
