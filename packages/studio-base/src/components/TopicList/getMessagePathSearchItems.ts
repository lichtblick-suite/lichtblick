// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { groupBy } from "lodash";

import { MessageDefinition } from "@foxglove/message-definition";
import { Immutable } from "@foxglove/studio";
import {
  quoteFieldNameIfNeeded,
  quoteTopicNameIfNeeded,
} from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { Topic } from "@foxglove/studio-base/src/players/types";

/**
 * Represents a message path inside a specific schema
 */
type MessagePathSuffix = Immutable<{
  /**
   * The message path suffix which can be appended to a topic name, e.g. `.header.stamp`
   */
  pathSuffix: string;
  /**
   * Human-readable type of the value or sub-message at this path, e.g. `foxglove.Point2` or `string[]`.
   */
  type: string;
  /** True if this path represents a value with no children underneath it. */
  isLeaf: boolean;
}>;

/**
 * @param prefix Prepended to each item's {@link MessagePathSuffix.pathSuffix}
 * @param seenSchemaNames List of schema names that have been visited, including the current {@link schema}
 */
function* generateMessagePathSuffixesForSchema(
  schema: Immutable<MessageDefinition>,
  schemasByName: Immutable<Map<string, MessageDefinition>>,
  prefix: string,
  seenSchemaNames: readonly string[],
): Iterable<MessagePathSuffix> {
  for (const { name, isArray, isConstant, isComplex, type } of schema.definitions) {
    if (isConstant === true) {
      continue;
    }

    const pathSuffix = `${prefix}.${quoteFieldNameIfNeeded(name)}`;
    yield {
      pathSuffix,
      type: isArray === true ? `${type}[]` : type,
      isLeaf: isComplex !== true,
    };

    if (isComplex === true) {
      if (seenSchemaNames.includes(type)) {
        continue;
      }
      const fieldSchema = schemasByName.get(type);
      if (!fieldSchema) {
        continue;
      }
      yield* generateMessagePathSuffixesForSchema(
        fieldSchema,
        schemasByName,
        isArray === true ? `${pathSuffix}[:]` : pathSuffix,
        [...seenSchemaNames, type],
      );
    }
  }
}

export type MessagePathSearchItem = {
  topic: Topic;
  suffix: MessagePathSuffix;
  /** Full message path, e.g. `/my_topic.header.stamp` */
  fullPath: string;
  /**
   * Offset of `suffix.pathSuffix` in the `fullPath` (differs from `topic.name.length` if the topic name requires quoting)
   */
  offset: number;
};

/**
 * Get the list of all message path search items in the TopicList (entries to be passed to fzf).
 * This includes an entry for each message path nested underneath each topic.
 */
export function getMessagePathSearchItems(
  allTopics: readonly Topic[],
  schemasByName: Immutable<Map<string, MessageDefinition>>,
): { items: MessagePathSearchItem[]; itemsByTopicName: Map<string, MessagePathSearchItem[]> } {
  const items: MessagePathSearchItem[] = [];
  const itemsByTopicName = new Map<string, MessagePathSearchItem[]>();
  const topicsBySchemaName = groupBy(
    allTopics.filter((topic) => topic.schemaName != undefined),
    (topic) => topic.schemaName,
  );
  for (const [schemaName, topics] of Object.entries(topicsBySchemaName)) {
    const schema = schemasByName.get(schemaName);
    if (!schema) {
      continue;
    }
    for (const suffix of generateMessagePathSuffixesForSchema(schema, schemasByName, "", [
      schemaName,
    ])) {
      for (const topic of topics) {
        const quotedTopicName = quoteTopicNameIfNeeded(topic.name);
        const item: MessagePathSearchItem = {
          topic,
          suffix,
          fullPath: quotedTopicName + suffix.pathSuffix,
          offset: quotedTopicName.length,
        };
        items.push(item);

        let itemsForTopic = itemsByTopicName.get(topic.name);
        if (!itemsForTopic) {
          itemsForTopic = [];
          itemsByTopicName.set(topic.name, itemsForTopic);
        }
        itemsForTopic.push(item);
      }
    }
  }
  return { items, itemsByTopicName };
}
