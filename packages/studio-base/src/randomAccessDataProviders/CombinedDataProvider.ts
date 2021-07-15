// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { assign, flatten, isEqual } from "lodash";
import memoizeWeak from "memoize-weak";

import { Time, areEqual, compare, isGreaterThan, isLessThan } from "@foxglove/rostime";
import { Progress, MessageEvent } from "@foxglove/studio-base/players/types";
import {
  BlockCache,
  MemoryCacheBlock,
} from "@foxglove/studio-base/randomAccessDataProviders/MemoryCacheDataProvider";
import {
  RandomAccessDataProviderDescriptor,
  ExtensionPoint,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  RandomAccessDataProvider,
  MessageDefinitions,
  ParsedMessageDefinitions,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { RosDatatype } from "@foxglove/studio-base/types/RosDatatypes";
import filterMap from "@foxglove/studio-base/util/filterMap";
import { deepIntersect } from "@foxglove/studio-base/util/ranges";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import { clampTime } from "@foxglove/studio-base/util/time";

import rawMessageDefinitionsToParsed from "./rawMessageDefinitionsToParsed";

const sortTimes = (times: Time[]) => times.sort(compare);
const emptyGetMessagesResult = {
  rosBinaryMessages: undefined,
  parsedMessages: undefined,
};

const memoizedMergedBlock = memoizeWeak(
  (block1?: MemoryCacheBlock, block2?: MemoryCacheBlock): MemoryCacheBlock => {
    return {
      messagesByTopic: { ...block1?.messagesByTopic, ...block2?.messagesByTopic },
      sizeInBytes: (block1?.sizeInBytes ?? 0) + (block2?.sizeInBytes ?? 0),
    };
  },
);

// Exported for tests
export const mergedBlocks = (
  cache1: BlockCache | undefined,
  cache2: BlockCache | undefined,
): BlockCache | undefined => {
  if (cache1 == undefined) {
    return cache2;
  }
  if (cache2 == undefined) {
    return cache1;
  }
  if (!areEqual(cache1.startTime, cache2.startTime)) {
    // TODO(JP): Actually support merging of blocks for different start times. Or not bother at all,
    // and move the CombinedDataProvider to above the MemoryCacheDataProvider, so we don't have to do
    // block merging at all.
    return cache1;
  }
  const blocks = [];
  for (let i = 0; i < cache1.blocks.length || i < cache2.blocks.length; ++i) {
    blocks.push(memoizedMergedBlock(cache1.blocks[i], cache2.blocks[i]));
  }
  return { blocks, startTime: cache1.startTime };
};

const merge = <A, B>(
  messages1: readonly MessageEvent<A>[] | undefined,
  messages2: readonly MessageEvent<B>[] | undefined,
) => {
  if (messages1 == undefined) {
    return messages2;
  }
  if (messages2 == undefined) {
    return messages1;
  }
  const messages = new Array(messages1.length + messages2.length);
  let idx = 0;
  let index1 = 0;
  let index2 = 0;
  while (index1 < messages1.length && index2 < messages2.length) {
    const m1 = messages1[index1] as MessageEvent<A>;
    const m2 = messages2[index2] as MessageEvent<B>;
    if (isGreaterThan(m1.receiveTime, m2.receiveTime)) {
      messages[idx] = m2;
      ++index2;
    } else {
      messages[idx] = m1;
      ++index1;
    }

    ++idx;
  }
  // we've consumed either messages1 or messages2 fully
  // the remaining entries in the peer array are all older than those we've consumed
  while (index1 < messages1.length) {
    messages[idx++] = messages1[index1++];
  }
  while (index2 < messages2.length) {
    messages[idx++] = messages2[index2++];
  }
  return messages;
};

const mergeAllMessageTypes = (
  result1: GetMessagesResult,
  result2: GetMessagesResult,
): GetMessagesResult => ({
  parsedMessages: merge(result1.parsedMessages, result2.parsedMessages),
  rosBinaryMessages: merge(result1.rosBinaryMessages, result2.rosBinaryMessages),
});

const throwOnDuplicateTopics = (topics: string[]) => {
  [...topics].sort().forEach((topicName, i, sortedTopics) => {
    if (topicName === sortedTopics[i + 1]) {
      throw new Error(`Duplicate topic found: ${topicName}`);
    }
  });
};

const throwOnUnequalDatatypes = (datatypes: [string, RosDatatype][]) => {
  datatypes
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([datatype, definition], i, sortedDataTypes) => {
      const next = sortedDataTypes[i + 1];
      if (next && datatype === next[0] && !isEqual(definition, next[1])) {
        throw new Error(
          `Conflicting datatype definitions found for ${datatype}: ${JSON.stringify(
            definition,
          )} !== ${JSON.stringify(next[1])}`,
        );
      }
    });
};
// We parse all message definitions here and then merge them.
function mergeMessageDefinitions(initResult: InitializationResult[]): MessageDefinitions {
  const parsedMessageDefinitionArr: ParsedMessageDefinitions[] = initResult.map((result) =>
    rawMessageDefinitionsToParsed(result.messageDefinitions, result.topics),
  );
  throwOnUnequalDatatypes(
    flatten(parsedMessageDefinitionArr.map(({ datatypes }) => Object.entries(datatypes))),
  );
  throwOnDuplicateTopics(
    flatten(
      parsedMessageDefinitionArr.map(({ messageDefinitionsByTopic }) =>
        Object.keys(messageDefinitionsByTopic),
      ),
    ),
  );
  throwOnDuplicateTopics(
    flatten(
      parsedMessageDefinitionArr.map(({ parsedMessageDefinitionsByTopic }) =>
        Object.keys(parsedMessageDefinitionsByTopic),
      ),
    ),
  );

  return {
    type: "parsed",
    messageDefinitionsByTopic: assign(
      {},
      ...parsedMessageDefinitionArr.map(
        ({ messageDefinitionsByTopic }) => messageDefinitionsByTopic,
      ),
    ),
    parsedMessageDefinitionsByTopic: assign(
      {},
      ...parsedMessageDefinitionArr.map(
        ({ parsedMessageDefinitionsByTopic }) => parsedMessageDefinitionsByTopic,
      ),
    ),
    datatypes: assign({}, ...parsedMessageDefinitionArr.map(({ datatypes }) => datatypes)),
  };
}

const throwOnMixedParsedMessages = (childProvidesParsedMessages: boolean[]) => {
  if (childProvidesParsedMessages.includes(true) && childProvidesParsedMessages.includes(false)) {
    throw new Error("Data providers provide different message formats");
  }
};

function intersectProgress(progresses: Progress[]): Progress {
  if (progresses.length === 0) {
    return { fullyLoadedFractionRanges: [] };
  }

  let messageCache: BlockCache | undefined;
  for (const progress of progresses) {
    messageCache = mergedBlocks(messageCache, progress.messageCache);
  }

  return {
    fullyLoadedFractionRanges: deepIntersect(
      filterMap(progresses, (p) => p.fullyLoadedFractionRanges),
    ),
    ...(messageCache != undefined ? { messageCache } : undefined),
  };
}
function emptyProgress() {
  return { fullyLoadedFractionRanges: [{ start: 0, end: 0 }] };
}
function fullyLoadedProgress() {
  return { fullyLoadedFractionRanges: [{ start: 0, end: 1 }] };
}

type ProcessedInitializationResult = Readonly<{
  start: Time;
  end: Time;
  topicSet: Set<string>;
}>;

// A RandomAccessDataProvider that combines multiple underlying RandomAccessDataProviders, optionally adding topic prefixes
// or removing certain topics.
export default class CombinedDataProvider implements RandomAccessDataProvider {
  _providers: RandomAccessDataProvider[];
  // Initialization result will be undefined for providers that don't successfully initialize.
  _initializationResultsPerProvider: (ProcessedInitializationResult | undefined)[] = [];
  _progressPerProvider: (Progress | undefined)[];
  _extensionPoint?: ExtensionPoint;

  constructor(
    _: unknown,
    children: RandomAccessDataProviderDescriptor[],
    getDataProvider: GetDataProvider,
  ) {
    this._providers = children.map((descriptor) =>
      process.env.NODE_ENV === "test" && descriptor.name === "TestProvider"
        ? descriptor.args.provider
        : getDataProvider(descriptor),
    );
    // initialize progress to an empty range for each provider
    this._progressPerProvider = children.map((__) => undefined);
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this._extensionPoint = extensionPoint;

    const providerInitializePromises = this._providers.map(async (provider, idx) => {
      return await provider.initialize({
        ...extensionPoint,
        progressCallback: (progress: Progress) => {
          this._updateProgressForChild(idx, progress);
        },
      });
    });
    const initializeOutcomes = await Promise.allSettled(providerInitializePromises);
    const results = filterMap(initializeOutcomes, (result) => {
      return result.status === "fulfilled" ? result.value : undefined;
    });
    this._initializationResultsPerProvider = initializeOutcomes.map((outcome) => {
      if (outcome.status === "fulfilled") {
        const { start, end, topics } = outcome.value;
        return { start, end, topicSet: new Set(topics.map((t) => t.name)) };
      }
      sendNotification("Data unavailable", outcome.reason, "user", "warn");
      return undefined;
    });
    if (initializeOutcomes.every(({ status }) => status === "rejected")) {
      return new Promise(() => {
        // no-op
      }); // Just never finish initializing.
    }

    // Any providers that didn't report progress in `initialize` are assumed fully loaded
    this._progressPerProvider.forEach((p, i) => {
      this._progressPerProvider[i] = p ?? fullyLoadedProgress();
    });

    const start = sortTimes(results.map((result) => result.start)).shift();
    const end = sortTimes(results.map((result) => result.end)).pop();

    if (!start || !end) {
      return new Promise(() => {
        // no-op
      }); // Just never finish initializing.
    }

    // Error handling
    const mergedTopics = flatten(results.map(({ topics }) => topics));
    const mergedConnections = flatten(results.map(({ connections }) => connections));
    throwOnDuplicateTopics(mergedTopics.map(({ name }) => name));
    throwOnMixedParsedMessages(results.map(({ providesParsedMessages }) => providesParsedMessages));
    const combinedMessageDefinitions = mergeMessageDefinitions(results);
    const combinedProblems = results.flatMap((result) => result.problems);

    return {
      start,
      end,
      topics: mergedTopics,
      connections: mergedConnections,
      providesParsedMessages: results[0]?.providesParsedMessages ?? false,
      messageDefinitions: combinedMessageDefinitions,
      problems: combinedProblems,
    };
  }

  async close(): Promise<void> {
    await Promise.all(this._providers.map(async (provider) => await provider.close()));
  }

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    const messagesPerProvider = await Promise.all(
      this._providers.map(async (provider, index) => {
        const initializationResult = this._initializationResultsPerProvider[index];
        if (initializationResult == undefined) {
          return { parsedMessages: undefined, rosBinaryMessages: undefined };
        }
        const availableTopics = initializationResult.topicSet;
        const filterTopics = (maybeTopics: readonly string[] | undefined) =>
          maybeTopics?.filter((topic: string) => availableTopics.has(topic));
        const filteredTopicsByFormat = {
          parsedMessages: filterTopics(topics.parsedMessages),
          rosBinaryMessages: filterTopics(topics.rosBinaryMessages),
        };
        const hasSubscriptions = Object.values(filteredTopicsByFormat).some(
          (formatTopics) => formatTopics?.length,
        );
        if (!hasSubscriptions) {
          // If we don't need any topics from this provider, we shouldn't call getMessages at all.  Therefore,
          // the provider doesn't know that we currently don't care about any of its topics, so it won't report
          // its progress as being fully loaded, so we'll have to do that here ourselves.
          this._updateProgressForChild(index, fullyLoadedProgress());
          return emptyGetMessagesResult;
        }
        if (
          isLessThan(end, initializationResult.start) ||
          isLessThan(initializationResult.end, start)
        ) {
          // If we're totally out of bounds for this provider, we shouldn't call getMessages at all.
          return emptyGetMessagesResult;
        }
        const clampedStart = clampTime(start, initializationResult.start, initializationResult.end);
        const clampedEnd = clampTime(end, initializationResult.start, initializationResult.end);
        const providerResult = await provider.getMessages(
          clampedStart,
          clampedEnd,
          filteredTopicsByFormat,
        );
        for (const messages of Object.values(providerResult)) {
          if (messages == undefined) {
            continue;
          }
          for (const message of messages) {
            if (!availableTopics.has(message.topic)) {
              throw new Error(`Saw unexpected topic from provider ${index}: ${message.topic}`);
            }
          }
        }
        return providerResult;
      }),
    );

    let mergedMessages: GetMessagesResult = emptyGetMessagesResult;
    for (const messages of messagesPerProvider) {
      mergedMessages = mergeAllMessageTypes(mergedMessages, messages);
    }
    return mergedMessages;
  }

  _updateProgressForChild(providerIdx: number, progress: Progress): void {
    this._progressPerProvider[providerIdx] = progress;
    // Assume empty for unreported progress
    const cleanProgresses = this._progressPerProvider.map((p) => p ?? emptyProgress());
    const intersected = intersectProgress(cleanProgresses);
    this._extensionPoint?.progressCallback(intersected);
  }
}
