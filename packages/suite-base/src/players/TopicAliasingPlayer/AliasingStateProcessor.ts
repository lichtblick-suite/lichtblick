// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";

import { Immutable as Im, MessageEvent } from "@lichtblick/suite";
import {
  MessageBlock,
  PlayerAlert,
  PlayerState,
  Progress,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@lichtblick/suite-base/players/types";

import { BlockTopicProcessor } from "./BlockTopicProcessor";
import { IStateProcessor } from "./IStateProcessor";

export type TopicAliasMap = Map<string, string[]>;
type MessageBlocks = readonly (undefined | MessageBlock)[];

/**
 * StateProcessor implements IStateProcessor to apply topic aliases to player state and subscriptions.
 *
 * Note: it uses a set of memoized members to keep referential equality for the output player state
 * when the input is unchanged. This is important for downstream consumers which rely on referential
 * equality to detect changes and to avoid doing work when there are no changes.
 */
export class AliasingStateProcessor implements IStateProcessor {
  #alerts: PlayerAlert[] = [];

  /** Source topic to a list of aliases for the topic */
  #mapping: Im<TopicAliasMap>;

  /** Aliased topic back to the source topic */
  #inverseMapping: Im<TopicAliasMap>;

  #blockProcessors: BlockTopicProcessor[] = [];

  public constructor(mapping: Im<TopicAliasMap>, alerts?: PlayerAlert[]) {
    this.#mapping = mapping;
    this.#alerts = alerts ?? [];
    this.#inverseMapping = invertAliasMap(mapping);

    this.#blockProcessors = Array.from(mapping.entries()).map(
      ([topic, aliases]) => new BlockTopicProcessor(topic, aliases),
    );
  }

  /**
   * Aliases topics in a player state to a new player state with all topic name aliases
   * applied.
   *
   * Subscriptions are aliased to include the mapped and unmapped topics.
   */
  public process(playerState: PlayerState, subscriptions: Im<SubscribePayload[]>): PlayerState {
    const newState = {
      ...playerState,
      activeData: playerState.activeData ? { ...playerState.activeData } : undefined,
    };

    if (newState.activeData) {
      newState.activeData.topics = this.#aliasTopics(newState.activeData.topics);
      newState.activeData.messages = this.#aliasMessages(newState.activeData.messages);
      if (newState.activeData.publishedTopics) {
        newState.activeData.publishedTopics = this.#aliasPublishedTopics(
          newState.activeData.publishedTopics,
        );
      }
      if (newState.activeData.subscribedTopics) {
        newState.activeData.subscribedTopics = this.#aliasSubscribedTopics(
          newState.activeData.subscribedTopics,
          subscriptions,
        );
      }

      newState.activeData.topicStats = this.#aliasTopicStats(newState.activeData.topicStats);
    }

    if (newState.progress.messageCache) {
      newState.progress = this.#aliasProgress(newState.progress);
    }

    newState.alerts = this.#addAlerts(newState.alerts);

    return newState;
  }

  public aliasSubscriptions = memoizeWeak(
    (subcriptions: SubscribePayload[]): SubscribePayload[] => {
      return subcriptions.flatMap((sub) => {
        const mappings = this.#inverseMapping.get(sub.topic);
        if (!mappings) {
          return sub;
        }

        return mappings.map((topic) => ({
          ...sub,
          topic,
        }));
      });
    },
  );

  #addAlerts = memoizeWeak((existing: PlayerAlert[] | undefined): PlayerAlert[] | undefined => {
    return (existing ?? []).concat(this.#alerts);
  });

  #aliasBlocks = memoizeWeak((blocks: MessageBlocks): MessageBlocks => {
    return blocks.map((block, idx) => {
      if (!block) {
        return undefined;
      }

      const messagesByTopic = this.#blockProcessors.reduce((acc, processor) => {
        return {
          ...acc,
          ...processor.aliasBlock(block, idx),
        };
      }, block.messagesByTopic);

      return {
        ...block,
        messagesByTopic,
      };
    });
  });

  #aliasProgress = memoizeWeak((progress: Progress): Progress => {
    if (progress.messageCache == undefined) {
      return progress;
    }
    const newProgress: Progress = {
      ...progress,
      messageCache: {
        ...progress.messageCache,
        blocks: this.#aliasBlocks(progress.messageCache.blocks),
      },
    };
    return newProgress;
  });

  #aliasMessages = memoizeWeak((messages: Im<MessageEvent[]>): Im<MessageEvent[]> => {
    const mappedMessages: MessageEvent[] = [];

    for (const msg of messages) {
      mappedMessages.push(msg);
      const mappings = this.#mapping.get(msg.topic);
      if (mappings) {
        for (const topic of mappings) {
          mappedMessages.push({ ...msg, topic });
        }
      }
    }

    return mappedMessages;
  });

  #aliasPublishedTopics = memoizeWeak(
    (topics: Map<string, Set<string>>): Map<string, Set<string>> => {
      const mappedTopics = new Map<string, Set<string>>();
      for (const [key, values] of topics) {
        const mappedValues = [...values].flatMap((value) => this.#mapping.get(value) ?? value);
        mappedTopics.set(key, new Set([...values, ...mappedValues]));
      }
      return mappedTopics;
    },
  );

  #aliasSubscribedTopics = memoizeWeak(
    (
      topics: Map<string, Set<string>>,
      subcriptions: Im<SubscribePayload[]>,
    ): Map<string, Set<string>> => {
      const subscriptionsByTopic = _.groupBy(subcriptions, (sub) => sub.topic);
      const mappedTopics = new Map<string, Set<string>>();
      for (const [id, values] of topics) {
        const mappedValues = [...values].flatMap((value) => {
          // If we have a subscription to the unmapped topic, include that, otherwise include
          // the mapped topics.
          const mapped = this.#mapping.get(value);
          if (subscriptionsByTopic[value]) {
            return [value, ...(mapped ?? [])];
          } else if (mapped) {
            return mapped;
          } else {
            return value;
          }
        });
        mappedTopics.set(id, new Set(mappedValues));
      }
      return mappedTopics;
    },
  );

  #aliasTopics = memoizeWeak((topics: Topic[]): Topic[] => {
    return topics.flatMap((topic) => {
      const mappings = this.#mapping.get(topic.name);
      if (mappings) {
        return [
          topic,
          ...mappings.map((name) => ({
            ...topic,
            name,
            aliasedFromName: topic.name,
          })),
        ];
      } else {
        return topic;
      }
    });
  });

  #aliasTopicStats = memoizeWeak((stats: Map<string, TopicStats>): Map<string, TopicStats> => {
    const mappedStats = new Map<string, TopicStats>();

    for (const [topic, stat] of stats) {
      mappedStats.set(topic, stat);
      const mappings = this.#mapping.get(topic);
      if (mappings) {
        for (const mappedTopic of mappings) {
          mappedStats.set(mappedTopic, stat);
        }
      }
    }

    return mappedStats;
  });
}

// Inverts a mapping, used to reverse map incoming subscriptions to subscriptions we pass
// through to the wrapped player.
function invertAliasMap(aliasMap: Im<TopicAliasMap>): Im<TopicAliasMap> {
  const inverted: TopicAliasMap = new Map();
  for (const [key, values] of aliasMap.entries()) {
    for (const value of values) {
      const newValues = inverted.get(value) ?? [];
      newValues.push(key);
      inverted.set(value, newValues);
    }
  }
  return inverted;
}
