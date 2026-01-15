// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessagePathStructureItem, quoteTopicNameIfNeeded } from "@lichtblick/message-path";
import { messagePathsForStructure } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { StructureAllItemsByPathProps } from "@lichtblick/suite-base/components/MessagePathSyntax/types";

export const structureAllItemsByPath = ({
  noMultiSlices,
  validTypes,
  messagePathStructuresForDataype,
  topics,
}: StructureAllItemsByPathProps): Map<string, MessagePathStructureItem> => {
  const result = new Map<string, MessagePathStructureItem>();

  for (const topic of topics) {
    if (topic.schemaName == undefined) {
      continue;
    }

    const structureItem = messagePathStructuresForDataype[topic.schemaName];
    if (structureItem == undefined) {
      continue;
    }

    const allPaths = messagePathsForStructure(structureItem, {
      validTypes,
      noMultiSlices,
    });

    const quotedTopicName = quoteTopicNameIfNeeded(topic.name);

    for (const item of allPaths) {
      if (item.path === "") {
        // Plain topic items will be added via `topicNamesAutocompleteItems`
        continue;
      }
      result.set(quotedTopicName + item.path, item.terminatingStructureItem);
    }
  }
  return result;
};
