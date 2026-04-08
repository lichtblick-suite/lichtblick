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

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;

export function useDecodedMessageRange(
  topics: string[],
  pathStrings: string[],
): MessageDataItemsByPath[] {
  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(pathStrings);
  const subscribeMessageRange = useSubscribeMessageRange();
  const playerPresence = useMessagePipeline(selectPlayerPresence);

  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, MessageEvent[]>>({});
  const accumulatedRef = useRef<Record<string, MessageEvent[]>>({});
  const flushRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  useEffect(() => {
    const cancels: (() => void)[] = [];

    for (const topic of topics) {
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
