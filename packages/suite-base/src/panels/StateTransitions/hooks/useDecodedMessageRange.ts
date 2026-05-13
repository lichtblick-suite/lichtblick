// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo, useRef, useState } from "react";

import { MessageEvent } from "@lichtblick/suite";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;

export function useDecodedMessageRange(
  topics: string[],
  pathStrings: string[],
): MessageDataItemsByPath[] {
  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);
  const subscribeMessageRange = useSubscribeMessageRange();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && playerPresence === PlayerPresence.PRESENT) {
      setInitialized(true);
    }
  }, [playerPresence, initialized]);

  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, MessageEvent[]>>({});
  const accumulatedRef = useRef<Record<string, MessageEvent[]>>({});
  const flushRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  const cancelsByTopicRef = useRef<Map<string, () => void>>(new Map());
  const prevTopicsRef = useRef<string[]>([]);

  const subscribeTopicRef = useRef<(topic: string) => void>(() => {});
  subscribeTopicRef.current = (topic: string) => {
    const cancel = subscribeMessageRange({
      topic,
      onNewRangeIterator: async (batchIterator) => {
        accumulatedRef.current[topic] = [];
        setMessagesByTopic((prev) => ({ ...prev, [topic]: [] }));

        for await (const batch of batchIterator) {
          accumulatedRef.current[topic] ??= [];
          accumulatedRef.current[topic].push(...batch);

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
  };

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const prevSet = new Set(prevTopicsRef.current);
    const nextSet = new Set(topics);

    for (const topic of prevSet) {
      if (!nextSet.has(topic)) {
        cancelsByTopicRef.current.get(topic)?.();
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
      if (!prevSet.has(topic)) {
        subscribeTopicRef.current(topic);
      }
    }

    prevTopicsRef.current = topics;
  }, [topics, initialized]);

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
