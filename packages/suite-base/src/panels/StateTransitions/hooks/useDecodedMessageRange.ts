// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useMemo, useRef, useState } from "react";

import { parseMessagePath } from "@lichtblick/message-path/src/parseMessagePath";
import { MessageEvent } from "@lichtblick/suite";
import {
  MessageDataItemsByPath,
  useDecodeMessagePathsForMessagesByTopic,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { useSubscribeMessageRange } from "@lichtblick/suite-base/components/PanelExtensionAdapter";

import { StateTransitionConfig } from "../types";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;

export function useDecodedMessageRange(
  paths: StateTransitionConfig["paths"],
): MessageDataItemsByPath[] {
  const pathStrings = useMemo(() => paths.map(({ value }) => value), [paths]);
  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);
  const subscribeMessageRange = useSubscribeMessageRange();
  const playerPresence = useMessagePipeline(selectPlayerPresence);

  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, MessageEvent[]>>({});
  const accumulatedRef = useRef<Record<string, MessageEvent[]>>({});
  const flushRef = useRef<number | undefined>();

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const path of paths) {
      const parsed = parseMessagePath(path.value);
      if (parsed) {
        set.add(parsed.topicName);
      }
    }
    return [...set];
  }, [paths]);

  useEffect(() => {
    const cancels: (() => void)[] = [];

    for (const topic of topics) {
      const cancel = subscribeMessageRange({
        topic,
        onNewRangeIterator: async (batchIterator) => {
          accumulatedRef.current[topic] = [];
          setMessagesByTopic((prev) => ({ ...prev, [topic]: [] }));

          for await (const batch of batchIterator) {
            const messages = [...batch];
            (accumulatedRef.current[topic] ??= []).push(...messages);

            flushRef.current ??= window.setTimeout(() => {
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
      cancels.push(cancel);
    }

    return () => {
      if (flushRef.current != undefined) {
        clearTimeout(flushRef.current);
        flushRef.current = undefined;
      }
      for (const cancel of cancels) {
        cancel();
      }
    };
  }, [topics, subscribeMessageRange, playerPresence]);

  const decoded = useMemo(
    () => decodeMessagePathsForMessagesByTopic(messagesByTopic),
    [messagesByTopic, decodeMessagePathsForMessagesByTopic],
  );

  return [decoded];
}
