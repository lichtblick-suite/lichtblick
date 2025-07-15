// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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
}: StructureAllItemsByPathProps): Map<string, MessagePathStructureItem> =>
  new Map(
    topics.flatMap((topic) => {
      if (topic.schemaName == undefined) {
        return [];
      }
      const structureItem = messagePathStructuresForDataype[topic.schemaName];
      if (structureItem == undefined) {
        return [];
      }
      const allPaths = messagePathsForStructure(structureItem, {
        validTypes,
        noMultiSlices,
      });
      return filterMap(allPaths, (item) => {
        if (item.path === "") {
          // Plain topic items will be added via `topicNamesAutocompleteItems`
          return undefined;
        }
        return [quoteTopicNameIfNeeded(topic.name) + item.path, item.terminatingStructureItem];
      });
    }),
  );
