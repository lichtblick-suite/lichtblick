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

import { useRef, useMemo, useState, useEffect, useContext, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";

import Log from "@foxglove/log";
import {
  useMessagePipeline,
  MessagePipelineContext,
} from "@foxglove/studio-base/components/MessagePipeline";
import PanelContext from "@foxglove/studio-base/components/PanelContext";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import useShouldNotChangeOften from "@foxglove/studio-base/hooks/useShouldNotChangeOften";
import {
  MessageEvent,
  PlayerStateActiveData,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

const log = Log.getLogger(__filename);

type MessageReducer<T> = (arg0: T, message: MessageEvent<unknown>) => T;
type MessagesReducer<T> = (arg0: T, messages: readonly MessageEvent<unknown>[]) => T;
export type RequestedTopic = string | { topic: string };

// Compute the subscriptions to be requested from the player.
function useSubscriptions({
  requestedTopics,
  panelType,
  preloadingFallback,
}: {
  requestedTopics: readonly RequestedTopic[];
  panelType?: string;
  preloadingFallback: boolean;
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
          preloadingFallback,
          topic: request.topic,
          encoding: "image/compressed",
        };
      }
      return { requester, preloadingFallback, topic: request };
    });
  }, [preloadingFallback, panelType, requestedTopics]);
}

type Params<T> = {
  topics: readonly RequestedTopic[];

  // Functions called when the reducers change and for each newly received message.
  // The object is assumed to be immutable, so in order to trigger a re-render, the reducers must
  // return a new object.
  restore: (arg: T | undefined) => T;
  addMessage?: MessageReducer<T>;
  addMessages?: MessagesReducer<T>;

  // If the messages are in blocks and _all_ subscribers set `preloadingFallback`, addMessage
  // won't receive these messages. This is a useful optimization for "preloading fallback"
  // subscribers.
  // TODO(steel): Eventually we should deprecate these multiple ways of getting data, and we should
  // always have blocks available. Then `useMessageReducer` should just become a wrapper around
  // `useBlocksByTopic` for backwards compatibility.
  preloadingFallback?: boolean;
};

function selectRequestBackfill(ctx: MessagePipelineContext) {
  return ctx.requestBackfill;
}

function selectSetSubscriptions(ctx: MessagePipelineContext) {
  return ctx.setSubscriptions;
}

export function useMessageReducer<T>(props: Params<T>): T {
  const [id] = useState(() => uuidv4());
  const { type: panelType = undefined } = useContext(PanelContext) ?? {};

  // only one of the add message callbacks should be provided
  if ([props.addMessage, props.addMessages].filter(Boolean).length !== 1) {
    throw new Error(
      "useMessageReducer must be provided with exactly one of addMessage or addMessages",
    );
  }

  useShouldNotChangeOften(props.restore, () =>
    log.warn(
      "useMessageReducer restore() is changing frequently. " +
        "restore() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    ),
  );
  useShouldNotChangeOften(props.addMessage, () =>
    log.warn(
      "useMessageReducer addMessage() is changing frequently. " +
        "addMessage() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    ),
  );
  useShouldNotChangeOften(props.addMessages, () =>
    log.warn(
      "useMessageReducer addMessages() is changing frequently. " +
        "addMessages() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    ),
  );

  const requestedTopics = useDeepMemo(props.topics);
  const requestedTopicsSet = useMemo(
    () => new Set(requestedTopics.map((req) => (typeof req === "object" ? req.topic : req))),
    [requestedTopics],
  );
  const subscriptions = useSubscriptions({
    requestedTopics,
    panelType,
    preloadingFallback: props.preloadingFallback ?? false,
  });

  const setSubscriptions = useMessagePipeline(selectSetSubscriptions);
  useEffect(() => setSubscriptions(id, subscriptions), [id, setSubscriptions, subscriptions]);
  useCleanup(() => setSubscriptions(id, []));

  const requestBackfill = useMessagePipeline(selectRequestBackfill);

  // Whenever `subscriptions` change, request a backfill, since we'd like to show fresh data.
  useEffect(() => requestBackfill(), [requestBackfill, subscriptions]);

  const { restore, addMessage, addMessages } = props;

  const state = useRef<
    | Readonly<{
        messageEvents: PlayerStateActiveData["messages"] | undefined;
        lastSeekTime: number | undefined;
        reducedValue: T;
        restore: typeof restore;
        addMessage: typeof addMessage;
        addMessages: typeof addMessages;
      }>
    | undefined
  >();

  return useMessagePipeline(
    useCallback(
      // To compute the reduced value from new messages:
      // - Call restore() to initialize state, if lastSeekTime has changed, or if reducers have changed
      // - Call addMessage() or addMessages() if any new messages of interest have arrived
      // - Otherwise, return the previous reducedValue so that we don't trigger an unnecessary render.
      function selectReducedMessages(ctx: MessagePipelineContext): T {
        const messageEvents = ctx.playerState.activeData?.messages;
        const lastSeekTime = ctx.playerState.activeData?.lastSeekTime;

        let newReducedValue: T;
        if (!state.current || lastSeekTime !== state.current.lastSeekTime) {
          newReducedValue = restore(undefined);
        } else if (
          restore !== state.current.restore ||
          addMessage !== state.current.addMessage ||
          addMessages !== state.current.addMessages
        ) {
          newReducedValue = restore(state.current.reducedValue);
        } else {
          newReducedValue = state.current.reducedValue;
        }

        if (
          messageEvents &&
          messageEvents.length > 0 &&
          messageEvents !== state.current?.messageEvents
        ) {
          const filtered = messageEvents.filter(({ topic }) => requestedTopicsSet.has(topic));
          if (addMessages) {
            if (filtered.length > 0) {
              newReducedValue = addMessages(newReducedValue, filtered);
            }
          } else if (addMessage) {
            for (const messageEvent of filtered) {
              newReducedValue = addMessage(newReducedValue, messageEvent);
            }
          }
        }

        state.current = {
          messageEvents,
          lastSeekTime,
          reducedValue: newReducedValue,
          restore,
          addMessage,
          addMessages,
        };

        return state.current.reducedValue;
      },
      [addMessage, addMessages, restore, requestedTopicsSet],
    ),
  );
}
