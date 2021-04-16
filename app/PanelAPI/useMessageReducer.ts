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

import { useRef, useCallback, useMemo, useState, useEffect, useContext } from "react";
import { v4 as uuidv4 } from "uuid";

import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove-studio/app/components/MessagePipeline";
import PanelContext from "@foxglove-studio/app/components/PanelContext";
import useChangeDetector from "@foxglove-studio/app/hooks/useChangeDetector";
import useCleanup from "@foxglove-studio/app/hooks/useCleanup";
import useContextSelector from "@foxglove-studio/app/hooks/useContextSelector";
import useDeepMemo from "@foxglove-studio/app/hooks/useDeepMemo";
import useShouldNotChangeOften from "@foxglove-studio/app/hooks/useShouldNotChangeOften";
import { Message, MessageFormat, SubscribePayload } from "@foxglove-studio/app/players/types";

type MessageReducer<T> = (arg0: T, message: Message) => T;
type MessagesReducer<T> = (arg0: T, messages: readonly Message[]) => T;
export type RequestedTopic = string | { topic: string; imageScale: number };

// Apply changes in topics or messages to the reduced value.
function useReducedValue<T>(
  restore: (arg0?: T) => T,
  addMessage?: MessageReducer<T>,
  addMessages?: MessagesReducer<T>,
  addBobjects?: MessagesReducer<T>,
  lastSeekTime?: number,
  messages?: readonly Message[],
): T {
  const reducedValueRef = useRef<T | undefined>();

  const shouldClear = useChangeDetector([lastSeekTime], false);
  const reducersChanged = useChangeDetector([restore, addBobjects, addMessage, addMessages], false);
  const messagesChanged = useChangeDetector([messages], true);

  if (!reducedValueRef.current || shouldClear) {
    // Call restore to create an initial state and whenever seek time changes.
    reducedValueRef.current = restore(undefined);
  } else if (reducersChanged) {
    // Allow new reducers to restore the previous state when the reducers change.
    reducedValueRef.current = restore(reducedValueRef.current);
  }

  // Use the addMessage reducer to process new messages.
  if (messagesChanged && messages) {
    if (addBobjects) {
      if (messages.length > 0) {
        reducedValueRef.current = addBobjects(reducedValueRef.current, messages);
      }
    } else if (addMessages) {
      if (messages.length > 0) {
        reducedValueRef.current = addMessages(reducedValueRef.current, messages);
      }
    } else if (addMessage) {
      reducedValueRef.current = messages.reduce(
        // .reduce() passes 4 args to callback function,
        // but we want to call addMessage with only first 2 args
        (value: T, message: Message) => addMessage(value, message),
        reducedValueRef.current,
      );
    }
  }

  return reducedValueRef.current;
}

// Compute the subscriptions to be requested from the player.
function useSubscriptions({
  requestedTopics,
  panelType,
  preloadingFallback,
  format,
}: {
  requestedTopics: readonly RequestedTopic[];
  panelType?: string;
  preloadingFallback: boolean;
  format: MessageFormat;
}): SubscribePayload[] {
  return useMemo(() => {
    const requester: SubscribePayload["requester"] =
      panelType != undefined ? { type: "panel", name: panelType } : undefined;

    return requestedTopics.map((request) => {
      if (typeof request === "object") {
        // We might be able to remove the `encoding` field from the protocol entirely, and only
        // use scale. Or we can deal with scaling down in a different way altogether, such as having
        // special topics or syntax for scaled down versions of images or so. In any case, we should
        // be cautious about having metadata on subscriptions, as that leads to the problem of how to
        // deal with multiple subscriptions to the same topic but with different metadata.
        return {
          requester,
          format,
          preloadingFallback,
          topic: request.topic,
          encoding: "image/compressed",
          scale: request.imageScale,
        };
      }
      return { requester, preloadingFallback, format, topic: request };
    });
  }, [preloadingFallback, format, panelType, requestedTopics]);
}

const NO_MESSAGES = Object.freeze([]);

type Props<T> = {
  topics: readonly RequestedTopic[];

  // Functions called when the reducers change and for each newly received message.
  // The object is assumed to be immutable, so in order to trigger a re-render, the reducers must
  // return a new object.
  restore: (arg0: T | undefined) => T;
  addMessage?: MessageReducer<T>;
  addMessages?: MessagesReducer<T>;
  addBobjects?: MessagesReducer<T>;

  // If the messages are in blocks and _all_ subscribers set `preloadingFallback`, addMessage
  // won't receive these messages. This is a useful optimization for "preloading fallback"
  // subscribers.
  // TODO(steel): Eventually we should deprecate these multiple ways of getting data, and we should
  // always have blocks available. Then `useMessageReducer` should just become a wrapper around
  // `useBlocksByTopic` for backwards compatibility.
  preloadingFallback?: boolean;
};

export function useMessageReducer<T>(props: Props<T>): T {
  const [id] = useState(() => uuidv4());
  const { type: panelType = undefined } = useContext(PanelContext) ?? {};

  // only one of the add message callbacks should be provided
  if ([props.addMessage, props.addMessages, props.addBobjects].filter(Boolean).length !== 1) {
    throw new Error(
      "useMessageReducer must be provided with exactly one of addMessage, addMessages or addBobjects",
    );
  }

  useShouldNotChangeOften(props.restore, () =>
    console.warn(
      "useMessageReducer restore() is changing frequently. " +
        "restore() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    ),
  );
  useShouldNotChangeOften(props.addMessage, () =>
    console.warn(
      "useMessageReducer addMessage() is changing frequently. " +
        "restore() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    ),
  );
  useShouldNotChangeOften(props.addMessages, () =>
    console.warn(
      "useMessageReducer addMessages() is changing frequently. " +
        "restore() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    ),
  );

  const requestedTopics = useDeepMemo(props.topics);
  const requestedTopicsSet = useMemo(
    () => new Set(requestedTopics.map((req) => (typeof req === "object" ? req.topic : req))),
    [requestedTopics],
  );
  const format = props.addBobjects != undefined ? "bobjects" : "parsedMessages";
  const subscriptions = useSubscriptions({
    requestedTopics,
    panelType,
    preloadingFallback: props.preloadingFallback ?? false,
    format,
  });
  const setSubscriptions = useMessagePipeline(
    useCallback(
      ({ setSubscriptions: pipelineSetSubscriptions }: MessagePipelineContext) =>
        pipelineSetSubscriptions,
      [],
    ),
  );
  useEffect(() => setSubscriptions(id, subscriptions), [id, setSubscriptions, subscriptions]);
  useCleanup(() => setSubscriptions(id, []));

  const requestBackfill = useMessagePipeline(
    useCallback(
      ({ requestBackfill: pipelineRequestBackfill }: MessagePipelineContext) =>
        pipelineRequestBackfill,
      [],
    ),
  );
  // Whenever `subscriptions` change, request a backfill, since we'd like to show fresh data.
  useEffect(() => requestBackfill(), [requestBackfill, subscriptions]);

  // Keep a reference to the last messages we processed to ensure we never process them more than once.
  // If the topics we care about change, the player should send us new messages soon anyway (via backfill if paused).
  const lastProcessedMessagesRef = useRef<readonly Message[] | undefined>();
  // Keep a ref to the latest requested topics we were rendered with, because the useMessagePipeline
  // selector's dependencies aren't allowed to change.
  const latestRequestedTopicsRef = useRef(requestedTopicsSet);
  latestRequestedTopicsRef.current = requestedTopicsSet;
  const messages = useMessagePipeline<readonly Message[]>(
    useCallback(
      ({ playerState: { activeData } }: MessagePipelineContext) => {
        if (!activeData) {
          return NO_MESSAGES; // identity must not change to avoid unnecessary re-renders
        }
        const messageData = format === "bobjects" ? activeData.bobjects : activeData.messages;
        if (lastProcessedMessagesRef.current === messageData) {
          return useContextSelector.BAILOUT;
        }
        const filteredMessages = messageData.filter(({ topic }) =>
          latestRequestedTopicsRef.current.has(topic),
        );
        // Bail out if we didn't want any of these messages, but not if this is our first render
        const shouldBail =
          lastProcessedMessagesRef.current != undefined && filteredMessages.length === 0;
        lastProcessedMessagesRef.current = messageData;
        return shouldBail ? useContextSelector.BAILOUT : filteredMessages;
      },
      [format],
    ),
  );

  const lastSeekTime = useMessagePipeline(
    useCallback(
      ({ playerState: { activeData } }: MessagePipelineContext) =>
        activeData ? activeData.lastSeekTime : 0,
      [],
    ),
  );

  return useReducedValue<T>(
    props.restore,
    props.addMessage,
    props.addMessages,
    props.addBobjects,
    lastSeekTime,
    messages,
  );
}
