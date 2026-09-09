// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { compare, Time } from "@lichtblick/rostime";
import { Initialization } from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import {
  InitMetadata,
  InitTopicStatsMap,
} from "@lichtblick/suite-base/players/IterablePlayer/shared/types";

import { validateAndAddNewDatatypes, validateAndAddNewTopics } from "./validateInitialization";

export const setStartTime = (accumulated: Time, current: Time): Time => {
  return compare(current, accumulated) < 0 ? current : accumulated;
};

export const setEndTime = (accumulated: Time, current: Time): Time => {
  return compare(current, accumulated) > 0 ? current : accumulated;
};

export const mergeMetadata = (accumulated: InitMetadata, current: InitMetadata): InitMetadata => {
  return [...(accumulated ?? []), ...(current ?? [])];
};

export const accumulateMap = <V>(
  accumulated: Map<string, V>,
  current: Map<string, V>,
): Map<string, V> => {
  return new Map<string, V>([...accumulated, ...current]);
};

export const mergeTopicStats = (
  accumulated: InitTopicStatsMap,
  current: InitTopicStatsMap,
): InitTopicStatsMap => {
  for (const [topic, stats] of current) {
    if (!accumulated.has(topic)) {
      accumulated.set(topic, { numMessages: 0 });
    }
    const accStats = accumulated.get(topic)!;

    accStats.numMessages += stats.numMessages;
    // Keep the earliest firstMessageTime
    if (
      stats.firstMessageTime &&
      (!accStats.firstMessageTime || compare(stats.firstMessageTime, accStats.firstMessageTime) < 0)
    ) {
      accStats.firstMessageTime = stats.firstMessageTime;
    }

    // Keep the latest lastMessageTime
    if (
      stats.lastMessageTime &&
      (!accStats.lastMessageTime || compare(stats.lastMessageTime, accStats.lastMessageTime) > 0)
    ) {
      accStats.lastMessageTime = stats.lastMessageTime;
    }
  }
  return accumulated;
};

/**
 * Merge several source initializations into a single one.
 *
 * Combines start/end times, profile, publishers, topic stats, metadata and alerts, and validates
 * that topics/datatypes are consistent across sources (adding warning alerts on mismatch).
 *
 * Shared by sources that aggregate multiple underlying sources (e.g. MultiIterableSource for
 * same-type sources and CombinedIterableSource for heterogeneous/additional sources).
 */
export const mergeInitializations = (initializations: Initialization[]): Initialization => {
  const resultInit: Initialization = {
    start: { sec: Number.MAX_SAFE_INTEGER, nsec: Number.MAX_SAFE_INTEGER },
    end: { sec: Number.MIN_SAFE_INTEGER, nsec: Number.MIN_SAFE_INTEGER },
    datatypes: new Map(),
    metadata: [],
    alerts: [],
    profile: "",
    publishersByTopic: new Map(),
    topics: [],
    topicStats: new Map(),
  };

  for (const init of initializations) {
    resultInit.start = setStartTime(resultInit.start, init.start);
    resultInit.end = setEndTime(resultInit.end, init.end);

    resultInit.profile = init.profile ?? resultInit.profile;
    resultInit.publishersByTopic = accumulateMap(
      resultInit.publishersByTopic,
      init.publishersByTopic,
    );
    resultInit.topicStats = mergeTopicStats(resultInit.topicStats, init.topicStats);
    resultInit.metadata = mergeMetadata(resultInit.metadata, init.metadata);
    resultInit.alerts.push(...init.alerts);
    // These methods validate and add to avoid looping through all topics and datatypes again
    validateAndAddNewDatatypes(resultInit, init);
    validateAndAddNewTopics(resultInit, init);
  }

  return resultInit;
};
