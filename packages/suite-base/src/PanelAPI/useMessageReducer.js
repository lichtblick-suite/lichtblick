// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
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
import { useShallowMemo } from "@lichtblick/hooks";
import Log from "@lichtblick/log";
import { useMessagePipeline, } from "@lichtblick/suite-base/components/MessagePipeline";
import useShouldNotChangeOften from "@lichtblick/suite-base/hooks/useShouldNotChangeOften";
const log = Log.getLogger(__filename);
function selectSetSubscriptions(ctx) {
    return ctx.setSubscriptions;
}
export function useMessageReducer(props) {
    const [id] = useState(() => uuidv4());
    const { restore, addMessage, addMessages, preloadType = "partial" } = props;
    // only one of the add message callbacks should be provided
    if ([props.addMessage, props.addMessages].filter(Boolean).length !== 1) {
        throw new Error("useMessageReducer must be provided with exactly one of addMessage or addMessages");
    }
    useShouldNotChangeOften(props.restore, () => {
        log.warn("useMessageReducer restore() is changing frequently. " +
            "restore() will be called each time it changes, so a new function " +
            "shouldn't be created on each render. (If you're using Hooks, try useCallback.)");
    });
    useShouldNotChangeOften(props.addMessage, () => {
        log.warn("useMessageReducer addMessage() is changing frequently. " +
            "addMessage() will be called each time it changes, so a new function " +
            "shouldn't be created on each render. (If you're using Hooks, try useCallback.)");
    });
    useShouldNotChangeOften(props.addMessages, () => {
        log.warn("useMessageReducer addMessages() is changing frequently. " +
            "addMessages() will be called each time it changes, so a new function " +
            "shouldn't be created on each render. (If you're using Hooks, try useCallback.)");
    });
    const requestedTopics = useShallowMemo(props.topics);
    const subscriptions = useMemo(() => {
        return requestedTopics.map((topic) => {
            if (typeof topic === "string") {
                return { topic, preloadType };
            }
            else {
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
    const state = useRef();
    return useMessagePipeline(useCallback(
    // To compute the reduced value from new messages:
    // - Call restore() to initialize state, if lastSeekTime has changed, or if reducers have changed
    // - Call addMessage() or addMessages() if any new messages of interest have arrived
    // - Otherwise, return the previous reducedValue so that we don't trigger an unnecessary render.
    function selectReducedMessages(ctx) {
        const messageEvents = ctx.messageEventsBySubscriberId.get(id);
        const lastSeekTime = ctx.playerState.activeData?.lastSeekTime;
        let newReducedValue;
        if (!state.current || lastSeekTime !== state.current.lastSeekTime) {
            newReducedValue = restore(undefined);
        }
        else if (restore !== state.current.restore ||
            addMessage !== state.current.addMessage ||
            addMessages !== state.current.addMessages) {
            newReducedValue = restore(state.current.reducedValue);
        }
        else {
            newReducedValue = state.current.reducedValue;
        }
        if (messageEvents &&
            messageEvents.length > 0 &&
            messageEvents !== state.current?.messageEvents) {
            if (addMessages) {
                if (messageEvents.length > 0) {
                    newReducedValue = addMessages(newReducedValue, messageEvents);
                }
            }
            else if (addMessage) {
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
    }, [id, addMessage, addMessages, restore]));
}
