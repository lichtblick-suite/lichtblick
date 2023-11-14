// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";

import { Immutable as Im, MessageEvent } from "@foxglove/studio";
import {
  MessageBlock,
  PlayerProblem,
  PlayerState,
  Progress,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";

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
  #problems: PlayerProblem[] = [];
  #mapping: Im<TopicAliasMap>;
  #inverseMapping: Im<TopicAliasMap>;

  public constructor(mapping: Im<TopicAliasMap>, problems?: PlayerProblem[]) {
    this.#mapping = mapping;
    this.#problems = problems ?? [];
    this.#inverseMapping = invertAliasMap(mapping);
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

    newState.problems = this.#addProblems(newState.problems);

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

  #addProblems = memoizeWeak(
    (existing: PlayerProblem[] | undefined): PlayerProblem[] | undefined => {
      return (existing ?? []).concat(this.#problems);
    },
  );

  #aliasBlocks = memoizeWeak((blocks: MessageBlocks): MessageBlocks => {
    return blocks.map((block) => {
      if (block == undefined) {
        return undefined;
      }

      return {
        ...block,
        messagesByTopic: _.transform(
          block.messagesByTopic,
          (acc, messages, topic) => {
            const mappings = this.#mapping.get(topic);
            if (mappings) {
              for (const mappedTopic of mappings) {
                acc[mappedTopic] = messages.map((msg) => ({
                  ...msg,
                  topic: mappedTopic,
                }));
              }
            }
            acc[topic] = messages;
          },
          {} as Record<string, MessageEvent[]>,
        ),
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
