// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MessageEvent } from "@lichtblick/suite";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";

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

  const decoded = useMemo(
    () => decodeMessagePathsForMessagesByTopic(messagesByTopic),
    [messagesByTopic, decodeMessagePathsForMessagesByTopic],
  );

  return [decoded];
}
