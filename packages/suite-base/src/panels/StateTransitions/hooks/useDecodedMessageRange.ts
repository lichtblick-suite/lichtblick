// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MessageEvent } from "@lichtblick/suite";
import {
  MessageAndData,
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";

type TopicDecodeCache = {
  source: readonly MessageEvent[];
  decodedCount: number;
  itemsByPath: Record<string, MessageAndData[]>;
};

type DecodeCache = {
  decode: ReturnType<typeof useDecodeMessagePathsForMessagesByTopic>;
  topics: Map<string, TopicDecodeCache>;
};

export function useDecodedMessageRange(
  topics: string[],
  pathStrings: string[],
): MessageDataItemsByPath[] {
  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);
  const subscribeMessageRange = useSubscribeMessageRange();

  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, MessageEvent[]>>({});
  const accumulatedRef = useRef<Record<string, MessageEvent[]>>({});
  const flushRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  // Never replace .current — only mutate in place. The unmount cleanup captures
  // this reference at mount time and relies on it remaining the same object.
  const cancelsByTopicRef = useRef<Map<string, () => void>>(new Map());
  const subscribeTopic = useCallback(
    (topic: string) => {
      const cancel = subscribeMessageRange({
        topic,
        onNewRangeIterator: async (batchIterator) => {
          accumulatedRef.current[topic] = [];
          setMessagesByTopic((prev) => ({ ...prev, [topic]: [] }));

          for await (const batch of batchIterator) {
            accumulatedRef.current[topic] ??= [];
            accumulatedRef.current[topic].push(...batch);

            // Wait 250ms before updating state so that batches arriving in quick
            // succession are grouped into one update instead of re-rendering the
            // chart for each batch individually.
            // Less batches means faster updates and better performance
            flushRef.current ??= globalThis.setTimeout(() => {
              flushRef.current = undefined;
              setMessagesByTopic({ ...accumulatedRef.current });
            }, 250);
          }

          // Final flush after iterator completes
          if (flushRef.current != undefined) {
            clearTimeout(flushRef.current);
            flushRef.current = undefined;
          }
          setMessagesByTopic({ ...accumulatedRef.current });
        },
      });
      cancelsByTopicRef.current.set(topic, cancel);
    },
    [subscribeMessageRange],
  );

  useEffect(() => {
    const nextSet = new Set(topics);

    // Unsubscribe topics that are no longer needed.
    for (const [topic, cancel] of cancelsByTopicRef.current) {
      if (!nextSet.has(topic)) {
        cancel();
        cancelsByTopicRef.current.delete(topic);
        delete accumulatedRef.current[topic];
        setMessagesByTopic((prev) => {
          const next = { ...prev };
          delete next[topic];
          return next;
        });
      }
    }

    for (const topic of nextSet) {
      if (!cancelsByTopicRef.current.has(topic)) {
        subscribeTopic(topic);
      }
    }
  }, [topics, subscribeTopic]);

  // Clean up all subscriptions on unmount.
  useEffect(() => {
    const cancels = cancelsByTopicRef.current;
    const flush = flushRef;
    return () => {
      if (flush.current != undefined) {
        clearTimeout(flush.current);
        flush.current = undefined;
      }
      for (const cancel of cancels.values()) {
        cancel();
      }
      cancels.clear();
    };
  }, []);

  const decodeCacheRef = useRef<DecodeCache | undefined>(undefined);

  // Accumulated arrays only grow until a new range iterator replaces them, so only messages added
  // since the last render need decoding. The per-path arrays are appended to in place.
  const decoded = useMemo((): MessageDataItemsByPath => {
    let cache = decodeCacheRef.current;
    if (cache?.decode !== decodeMessagePathsForMessagesByTopic) {
      cache = { decode: decodeMessagePathsForMessagesByTopic, topics: new Map() };
      decodeCacheRef.current = cache;
    }

    for (const topic of cache.topics.keys()) {
      if (messagesByTopic[topic] == undefined) {
        cache.topics.delete(topic);
      }
    }

    // Invalid paths get an empty entry even without messages.
    const out: Record<string, readonly MessageAndData[]> = {
      ...decodeMessagePathsForMessagesByTopic({}),
    };
    for (const [topic, messages] of Object.entries(messagesByTopic)) {
      let topicCache = cache.topics.get(topic);
      const isNew = topicCache?.source !== messages || messages.length < topicCache.decodedCount;
      if (isNew || topicCache == undefined) {
        topicCache = { source: messages, decodedCount: 0, itemsByPath: {} };
        cache.topics.set(topic, topicCache);
      }
      if (isNew || messages.length > topicCache.decodedCount) {
        const newItemsByPath = decodeMessagePathsForMessagesByTopic({
          [topic]: messages.slice(topicCache.decodedCount),
        });
        topicCache.decodedCount = messages.length;
        for (const [path, items] of Object.entries(newItemsByPath)) {
          const existing = topicCache.itemsByPath[path];
          if (existing == undefined) {
            topicCache.itemsByPath[path] = [...items];
          } else {
            for (const item of items) {
              existing.push(item);
            }
          }
        }
      }
      Object.assign(out, topicCache.itemsByPath);
    }
    return out;
  }, [messagesByTopic, decodeMessagePathsForMessagesByTopic]);

  return useMemo(() => [decoded], [decoded]);
}
