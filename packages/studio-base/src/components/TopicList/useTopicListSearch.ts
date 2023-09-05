// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Fzf, FzfResultItem, basicMatch } from "fzf";
import { groupBy } from "lodash";
import { useMemo } from "react";

import { MessageDefinition } from "@foxglove/message-definition";
import { Immutable } from "@foxglove/studio";
import { Topic } from "@foxglove/studio-base/players/types";

import { MessagePathSearchItem, getMessagePathSearchItems } from "./getMessagePathSearchItems";

function topicToFzfResult(item: Topic): FzfResultItem<Topic> {
  return {
    item,
    score: 0,
    positions: new Set<number>(),
    start: 0,
    end: 0,
  };
}

export type TopicListItem =
  | { type: "topic"; item: FzfResultItem<Topic> }
  | { type: "schema"; item: FzfResultItem<MessagePathSearchItem> };

export type UseTopicListSearchParams = {
  topics: Immutable<Topic[]>;
  datatypes: Immutable<Map<string, MessageDefinition>>;
  filterText: string;
};

/**
 * Returns a filtered list of {@link TopicListItem}s based on the given filter text.
 */
export function useTopicListSearch(params: UseTopicListSearchParams): TopicListItem[] {
  const { topics, datatypes, filterText } = params;

  const topicsAndSchemaNamesFzf = useMemo(
    () =>
      new Fzf(topics, {
        selector: (item) => `${item.name}|${item.schemaName}`,
      }),
    [topics],
  );

  const messagePathSearchItems = useMemo(
    () => getMessagePathSearchItems(topics, datatypes),
    [topics, datatypes],
  );
  const messagePathsFzf = useMemo(
    () =>
      new Fzf(messagePathSearchItems.items, {
        selector: (item) => item.fullPath,
        // Use a custom matcher to exclude results if the query matched only the topic name and not
        // the path `suffix`. In this case we show only the topic row and not the message path rows.
        match(query) {
          const results = basicMatch.call<
            typeof this,
            [string],
            FzfResultItem<MessagePathSearchItem>[]
          >(this, query);
          // `offset` denotes the beginning of the `suffix` +1 also excludes results that match only the `.`
          return results.filter((result) => result.end > result.item.offset + 1);
        },
      }),
    [messagePathSearchItems],
  );

  const filteredTopics: FzfResultItem<Topic>[] = useMemo(
    () => (filterText ? topicsAndSchemaNamesFzf.find(filterText) : topics.map(topicToFzfResult)),
    [filterText, topics, topicsAndSchemaNamesFzf],
  );

  const messagePathResults = useMemo(
    () => (filterText ? messagePathsFzf.find(filterText) : []),
    [filterText, messagePathsFzf],
  );

  const treeItems = useMemo(() => {
    const results: TopicListItem[] = [];

    const messagePathResultsByTopicName = groupBy(
      messagePathResults,
      (item) => item.item.topic.name,
    );

    // Gather all topics that either match or contain a matching message path
    const allTopicsToShowByName = new Map<string, Topic>();
    const matchedTopicsByName = new Map<string, FzfResultItem<Topic>>();
    for (const topic of filteredTopics) {
      allTopicsToShowByName.set(topic.item.name, topic.item);
      matchedTopicsByName.set(topic.item.name, topic);
    }
    for (const {
      item: { topic },
    } of messagePathResults) {
      allTopicsToShowByName.set(topic.name, topic);
    }

    // Sort topics with matches above topics that are only shown because they have matching paths
    const sortedTopics = Array.from(allTopicsToShowByName.values()).sort((a, b) => {
      const aMatched = matchedTopicsByName.has(a.name);
      const bMatched = matchedTopicsByName.has(b.name);
      if (aMatched && !bMatched) {
        return -1;
      } else if (!aMatched && bMatched) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    for (const topic of sortedTopics) {
      results.push({
        type: "topic",
        item: matchedTopicsByName.get(topic.name) ?? topicToFzfResult(topic),
      });
      const matchedMessagePaths = messagePathResultsByTopicName[topic.name];
      if (matchedMessagePaths == undefined) {
        continue;
      }
      for (const messagePathResult of matchedMessagePaths) {
        results.push({ type: "schema", item: messagePathResult });
      }
    }
    return results;
  }, [filteredTopics, messagePathResults]);

  return treeItems;
}
