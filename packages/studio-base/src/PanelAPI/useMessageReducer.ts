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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";
import Log from "@foxglove/log";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import useShouldNotChangeOften from "@foxglove/studio-base/hooks/useShouldNotChangeOften";
import {
  MessageEvent,
  PlayerStateActiveData,
  SubscribePayload,
  SubscriptionPreloadType,
} from "@foxglove/studio-base/players/types";

const log = Log.getLogger(__filename);

type MessageReducer<T> = (arg0: T, message: MessageEvent) => T;
type MessagesReducer<T> = (arg0: T, messages: readonly MessageEvent[]) => T;

type Params<T> = {
  topics: readonly string[] | SubscribePayload[];
  preloadType?: SubscriptionPreloadType;

  // Functions called when the reducers change and for each newly received message.
  // The object is assumed to be immutable, so in order to trigger a re-render, the reducers must
  // return a new object.
  restore: (arg: T | undefined) => T;
  addMessage?: MessageReducer<T>;
  addMessages?: MessagesReducer<T>;
};

function selectSetSubscriptions(ctx: MessagePipelineContext) {
  return ctx.setSubscriptions;
}

export function useMessageReducer<T>(props: Params<T>): T {
  const [id] = useState(() => uuidv4());
  const { restore, addMessage, addMessages, preloadType = "partial" } = props;

  // only one of the add message callbacks should be provided
  if ([props.addMessage, props.addMessages].filter(Boolean).length !== 1) {
    throw new Error(
      "useMessageReducer must be provided with exactly one of addMessage or addMessages",
    );
  }

  useShouldNotChangeOften(props.restore, () => {
    log.warn(
      "useMessageReducer restore() is changing frequently. " +
        "restore() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    );
  });
  useShouldNotChangeOften(props.addMessage, () => {
    log.warn(
      "useMessageReducer addMessage() is changing frequently. " +
        "addMessage() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    );
  });
  useShouldNotChangeOften(props.addMessages, () => {
    log.warn(
      "useMessageReducer addMessages() is changing frequently. " +
        "addMessages() will be called each time it changes, so a new function " +
        "shouldn't be created on each render. (If you're using Hooks, try useCallback.)",
    );
  });

  const requestedTopics = useShallowMemo(props.topics);

  const subscriptions = useMemo<SubscribePayload[]>(() => {
    return requestedTopics.map((topic) => {
      if (typeof topic === "string") {
        return { topic, preloadType };
      } else {
        return topic;
      }
    });
  }, [preloadType, requestedTopics]);

  const setSubscriptions = useMessagePipeline(selectSetSubscriptions);
  useEffect(() => {
    setSubscriptions(id, subscriptions);
  }, [id, setSubscriptions, subscriptions]);
  useEffect(() => {
    return () => {
      setSubscriptions(id, []);
    };
  }, [id, setSubscriptions]);

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
        const messageEvents = ctx.messageEventsBySubscriberId.get(id);
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
          if (addMessages) {
            if (messageEvents.length > 0) {
              newReducedValue = addMessages(newReducedValue, messageEvents);
            }
          } else if (addMessage) {
            for (const messageEvent of messageEvents) {
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
      [id, addMessage, addMessages, restore],
    ),
  );
}
