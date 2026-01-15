// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { enableMapSet } from "immer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useImmer } from "use-immer";

import Logger from "@lichtblick/log";
import { Time, compare } from "@lichtblick/rostime";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { MessagePipelineContext } from "@lichtblick/suite-base/components/MessagePipeline/types";
import { RESULT_TYPE_MESSAGE_EVENT } from "@lichtblick/suite-base/components/TopicList/constants";
import {
  TopicBoundaries,
  UseTopicMessageNavigationReturn,
} from "@lichtblick/suite-base/components/TopicList/types";

const log = Logger.getLogger(__filename);

const logNavigationError = (direction: "next" | "previous", error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  log.warn(`Error navigating to ${direction} message: ${message}`);
};

const selectCurrentTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.currentTime;
const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;
const selectTopicStats = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.topicStats;
const selectSeekPlayback = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectPausePlayback = (ctx: MessagePipelineContext) => ctx.pausePlayback;
const selectGetBatchIterator = (ctx: MessagePipelineContext) => ctx.getBatchIterator;

enableMapSet();

export function useTopicMessageNavigation({
  topicName,
  selected,
  isTopicSubscribed,
}: {
  topicName: string;
  selected: boolean;
  isTopicSubscribed: boolean;
}): UseTopicMessageNavigationReturn {
  const [isNavigating, setIsNavigating] = useState(false);
  const [boundariesCache, setBoundariesCache] = useImmer(() => new Map<string, TopicBoundaries>());
  const navigationAbortControllerRef = useRef<AbortController | undefined>(undefined);

  // Abort any in-progress navigation when the component unmounts
  useEffect(() => {
    return () => {
      navigationAbortControllerRef.current?.abort();
    };
  }, []);

  // Creates a new AbortSignal for navigation, aborting any previous in-progress navigation
  const createNavigationSignal = useCallback(() => {
    navigationAbortControllerRef.current?.abort();
    const controller = new AbortController();
    navigationAbortControllerRef.current = controller;
    return controller.signal;
  }, []);

  const currentTime = useMessagePipeline(selectCurrentTime);
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);
  const topicStats = useMessagePipeline(selectTopicStats);
  const seekPlayback = useMessagePipeline(selectSeekPlayback);
  const pausePlayback = useMessagePipeline(selectPausePlayback);
  const getBatchIterator = useMessagePipeline(selectGetBatchIterator);

  const cachedBoundaries = boundariesCache.get(topicName);
  const firstMessageTime = cachedBoundaries?.first;
  const lastMessageTime = cachedBoundaries?.last;

  // The boundaries cache avoids expensive re-iteration through all messages when
  // switching between topics. Merges partial boundary updates, preserving existing
  // values so first and last boundaries can be discovered independently
  // (e.g., handlePreviousMessage finds first, handleNextMessage finds last).
  const updateBoundariesCache = useCallback(
    (topic: string, updates: Partial<TopicBoundaries>) => {
      setBoundariesCache((draft) => {
        const existing = draft.get(topic) ?? {};
        draft.set(topic, { ...existing, ...updates });
      });
    },
    [setBoundariesCache],
  );

  const discoverBoundaries = useCallback(
    async (signal: AbortSignal, topic: string) => {
      const iterator = getBatchIterator(topic);
      if (!iterator) {
        return;
      }

      let first: Time | undefined;
      let last: Time | undefined;

      for await (const result of iterator) {
        if (signal.aborted) {
          return;
        }
        if (result.type === RESULT_TYPE_MESSAGE_EVENT) {
          const time = result.msgEvent.receiveTime;
          first ??= time;
          last = time;
        }
      }

      if (first != undefined || last != undefined) {
        updateBoundariesCache(topic, { first, last });
      }
    },
    [getBatchIterator, updateBoundariesCache],
  );

  useEffect(() => {
    const alreadyCached = boundariesCache.has(topicName);
    if (!selected || !isTopicSubscribed || alreadyCached) {
      return;
    }

    const abortController = new AbortController();
    void discoverBoundaries(abortController.signal, topicName);

    return () => {
      abortController.abort();
    };
  }, [topicName, selected, discoverBoundaries, boundariesCache, isTopicSubscribed]);

  const canNavigateNext = useMemo(() => {
    if (!currentTime || !topicStats) {
      return false;
    }

    const isAtPlaybackEnd = endTime != undefined && compare(currentTime, endTime) >= 0;
    const lastTopicMessageTime = topicStats.get(topicName)?.lastMessageTime ?? lastMessageTime;

    if (!lastTopicMessageTime) {
      return false;
    }

    const isAtLastTopicMessage = compare(currentTime, lastTopicMessageTime) >= 0;

    return !isAtPlaybackEnd && !isAtLastTopicMessage;
  }, [currentTime, endTime, topicStats, topicName, lastMessageTime]);

  const canNavigatePrevious = useMemo(() => {
    if (!currentTime || !topicStats) {
      return false;
    }

    const isAtPlaybackStart = startTime != undefined && compare(currentTime, startTime) <= 0;
    const firstTopicMessageTime = topicStats.get(topicName)?.firstMessageTime ?? firstMessageTime;

    if (!firstTopicMessageTime) {
      return false;
    }

    const isAtFirstTopicMessage = compare(currentTime, firstTopicMessageTime) <= 0;

    return !isAtPlaybackStart && !isAtFirstTopicMessage;
  }, [currentTime, startTime, topicStats, topicName, firstMessageTime]);

  const findNextMessage = useCallback(
    async (
      signal: AbortSignal,
      current: Time,
    ): Promise<{ targetTime: Time; isLastMessage: boolean } | undefined> => {
      const iterator = getBatchIterator(topicName);
      if (!iterator) {
        return undefined;
      }

      let targetTime: Time | undefined;
      let foundMessageAfterTarget = false;

      for await (const result of iterator) {
        if (signal.aborted) {
          return undefined;
        }
        if (result.type !== RESULT_TYPE_MESSAGE_EVENT) {
          continue;
        }

        const isAfterCurrent = compare(result.msgEvent.receiveTime, current) > 0;
        if (!isAfterCurrent) {
          continue;
        }

        if (targetTime) {
          foundMessageAfterTarget = true;
          break;
        }

        targetTime = result.msgEvent.receiveTime;
      }

      if (!targetTime) {
        return undefined;
      }

      return { targetTime, isLastMessage: !foundMessageAfterTarget };
    },
    [getBatchIterator, topicName],
  );

  const handleNextMessage = useCallback(async () => {
    if (isNavigating || !currentTime || !seekPlayback || !pausePlayback) {
      return;
    }

    const signal = createNavigationSignal();
    setIsNavigating(true);

    try {
      const result = await findNextMessage(signal, currentTime);

      if (signal.aborted) {
        return;
      }

      if (!result) {
        if (!lastMessageTime) {
          updateBoundariesCache(topicName, { last: currentTime });
        }
        return;
      }

      if (result.isLastMessage && !lastMessageTime) {
        updateBoundariesCache(topicName, { last: result.targetTime });
      }

      pausePlayback();
      seekPlayback(result.targetTime);
    } catch (error) {
      logNavigationError("next", error);
    } finally {
      if (!signal.aborted) {
        setIsNavigating(false);
      }
    }
  }, [
    isNavigating,
    currentTime,
    topicName,
    seekPlayback,
    pausePlayback,
    findNextMessage,
    lastMessageTime,
    updateBoundariesCache,
    createNavigationSignal,
  ]);

  const handlePreviousMessage = useCallback(async () => {
    if (isNavigating || !currentTime || !seekPlayback || !pausePlayback) {
      return;
    }

    const signal = createNavigationSignal();

    setIsNavigating(true);

    try {
      const iterator = getBatchIterator(topicName);
      if (!iterator) {
        return;
      }

      let firstBoundary: Time | undefined;
      let targetTime: Time | undefined;

      for await (const result of iterator) {
        if (signal.aborted) {
          return;
        }
        if (result.type !== RESULT_TYPE_MESSAGE_EVENT) {
          continue;
        }

        const messageTime = result.msgEvent.receiveTime;
        firstBoundary ??= messageTime;

        const isBeforeCurrent = compare(messageTime, currentTime) < 0;
        if (!isBeforeCurrent) {
          break;
        }

        targetTime = messageTime;
      }

      if (signal.aborted) {
        return;
      }

      if (firstBoundary && !firstMessageTime) {
        updateBoundariesCache(topicName, { first: firstBoundary });
      }

      if (!targetTime) {
        return;
      }

      pausePlayback();
      seekPlayback(targetTime);
    } catch (error) {
      logNavigationError("previous", error);
    } finally {
      if (!signal.aborted) {
        setIsNavigating(false);
      }
    }
  }, [
    isNavigating,
    currentTime,
    topicName,
    seekPlayback,
    pausePlayback,
    getBatchIterator,
    firstMessageTime,
    updateBoundariesCache,
    createNavigationSignal,
  ]);

  return {
    handleNextMessage,
    handlePreviousMessage,
    isNavigating,
    canNavigateNext,
    canNavigatePrevious,
  };
}
