// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Fzf, FzfResultItem, basicMatch } from "fzf";
import * as _ from "lodash-es";
import { useMemo } from "react";

import { MessageDefinition } from "@lichtblick/message-definition";
import { Immutable } from "@lichtblick/suite";

import { MessagePathSearchItem, getMessagePathSearchItems } from "./getMessagePathSearchItems";
import { InspectionTopic as Topic, inspectionTopicKey } from "./types";

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
        selector: (item) =>
          `${item.name}|${item.schemaName}|${item.channelId ?? ""}|${item.channel?.source.kind ?? ""}|${item.channel?.source.kind === "converted" ? item.channel.source.converterId : ""}`,
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
          // `offset` denotes the beginning of the `suffix`
          return results.filter((result) => result.end > result.item.offset);
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

    const messagePathResultsByTopicName = _.groupBy(messagePathResults, (item) =>
      inspectionTopicKey(item.item.topic),
    );

    // Gather all topics that either match or contain a matching message path
    const allTopicsToShowByName = new Map<string, { topic: Topic; maxScore: number }>();
    const matchedTopicsByName = new Map<string, FzfResultItem<Topic>>();
    for (const topic of filteredTopics) {
      allTopicsToShowByName.set(inspectionTopicKey(topic.item), {
        topic: topic.item,
        maxScore: topic.score,
      });
      matchedTopicsByName.set(inspectionTopicKey(topic.item), topic);
    }
    for (const {
      item: { topic },
      score,
    } of messagePathResults) {
      const existingTopic = allTopicsToShowByName.get(inspectionTopicKey(topic));
      if (existingTopic == undefined) {
        allTopicsToShowByName.set(inspectionTopicKey(topic), { topic, maxScore: score });
      } else if (score > existingTopic.maxScore) {
        existingTopic.maxScore = score;
      }
    }

    // Sort topics by max score across all paths, then topics with matches above topics that are only shown because they have matching paths
    const sortedTopics = Array.from(allTopicsToShowByName.values()).sort((a, b) => {
      if (a.maxScore !== b.maxScore) {
        return b.maxScore - a.maxScore;
      }

      const aMatched = matchedTopicsByName.has(inspectionTopicKey(a.topic));
      const bMatched = matchedTopicsByName.has(inspectionTopicKey(b.topic));
      if (aMatched !== bMatched) {
        return aMatched ? -1 : 1;
      }

      const byName = a.topic.name.localeCompare(b.topic.name);
      return byName !== 0
        ? byName
        : (a.topic.channelId ?? "").localeCompare(b.topic.channelId ?? "");
    });

    // Keep converter outputs immediately after their exact input channel. Include the input
    // as context when only an output matches the search, without adding unmatched siblings.
    const topicsByKey = new Map(topics.map((topic) => [inspectionTopicKey(topic), topic]));
    const sourceKey = (topic: Topic): string =>
      topic.channel?.source.kind === "converted"
        ? inspectionTopicKey({ name: topic.name, channelId: topic.channel.source.inputChannelId })
        : inspectionTopicKey(topic);
    const outputsBySource = new Map<string, Topic[]>();
    for (const { topic } of sortedTopics) {
      if (topic.channel?.source.kind === "converted") {
        const key = sourceKey(topic);
        const outputs = outputsBySource.get(key) ?? [];
        outputs.push(topic);
        outputsBySource.set(key, outputs);
      }
    }

    const groupedTopics: Topic[] = [];
    const added = new Set<string>();
    for (const { topic } of sortedTopics) {
      const key = sourceKey(topic);
      if (added.has(key)) {
        continue;
      }
      added.add(key);
      const source = topicsByKey.get(key);
      if (source != undefined) {
        groupedTopics.push(source);
      }
      groupedTopics.push(...(outputsBySource.get(key) ?? []));
    }

    for (const topic of groupedTopics) {
      results.push({
        type: "topic",
        item: matchedTopicsByName.get(inspectionTopicKey(topic)) ?? topicToFzfResult(topic),
      });
      const matchedMessagePaths = messagePathResultsByTopicName[inspectionTopicKey(topic)];
      if (matchedMessagePaths == undefined) {
        continue;
      }
      for (const messagePathResult of matchedMessagePaths) {
        results.push({ type: "schema", item: messagePathResult });
      }
    }
    return results;
  }, [filteredTopics, messagePathResults, topics]);

  return treeItems;
}
