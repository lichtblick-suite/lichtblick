// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
/* eslint-disable no-restricted-syntax */

import { filterMap } from "@lichtblick/den/collection";
import {
  MessagePathStructureItem,
  MessagePathStructureItemMessage,
  quoteTopicNameIfNeeded,
} from "@lichtblick/message-path";
import { messagePathsForStructure } from "@lichtblick/suite-base/components/MessagePathSyntax/messagePathsForDatatype";
import { Topic } from "@lichtblick/suite-base/players/types";

type StructureAllItemsByPathProps = {
  noMultiSlices?: boolean;
  validTypes?: readonly string[];
  messagePathStructuresForDataype: Record<string, MessagePathStructureItemMessage>;
  topics: readonly Topic[];
};

export const structureAllItemsByPath = ({
  noMultiSlices,
  validTypes,
  messagePathStructuresForDataype,
  topics,
}: StructureAllItemsByPathProps): Map<string, MessagePathStructureItem> => {
  const startTime = performance.now();
  console.log(`[structureAllItemsByPath] Starting with ${topics.length} topics`);

  // OPTIMIZATION: Single-pass iteration instead of flatMap + filterMap
  // This avoids creating intermediate arrays and reduces allocations
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

  const endTime = performance.now();
  console.log(
    `[structureAllItemsByPath] Completed in ${(endTime - startTime).toFixed(2)}ms, generated ${result.size} items`,
  );
  return result;
};
