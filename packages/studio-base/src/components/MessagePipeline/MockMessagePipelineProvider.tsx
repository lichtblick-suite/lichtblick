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

import { Immutable } from "immer";
import * as _ from "lodash-es";
import { MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import shallowequal from "shallowequal";
import { Writable } from "ts-essentials";
import { createStore } from "zustand";

import { Condvar } from "@foxglove/den/async";
import { Time, isLessThan } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import {
  FramePromise,
  pauseFrameForPromises,
} from "@foxglove/studio-base/components/MessagePipeline/pauseFrameForPromise";
import { BuiltinPanelExtensionContext } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import {
  AdvertiseOptions,
  MessageEvent,
  PlayerCapabilities,
  PlayerPresence,
  PlayerProblem,
  PlayerState,
  PlayerStateActiveData,
  PlayerURLState,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { ContextInternal } from "./index";
import { MessagePipelineInternalState, MessagePipelineStateAction, reducer } from "./store";
import { makeSubscriptionMemoizer } from "./subscriptions";

const NO_DATATYPES = new Map();

function noop() {}

export type MockMessagePipelineProps = {
  name?: string;
  presence?: PlayerPresence;
  topics?: Topic[];
  topicStats?: Map<string, TopicStats>;
  datatypes?: RosDatatypes;
  messages?: MessageEvent[];
  problems?: PlayerProblem[];
  publish?: (request: PublishPayload) => void;
  callService?: (service: string, request: unknown) => Promise<unknown>;
  setPublishers?: (arg0: string, arg1: AdvertiseOptions[]) => void;
  setSubscriptions?: (arg0: string, arg1: Immutable<SubscribePayload[]>) => void;
  setParameter?: (key: string, value: ParameterValue) => void;
  fetchAsset?: BuiltinPanelExtensionContext["unstable_fetchAsset"];
  noActiveData?: boolean;
  activeData?: Partial<PlayerStateActiveData>;
  capabilities?: string[];
  profile?: string;
  startPlayback?: () => void;
  pausePlayback?: () => void;
  seekPlayback?: (arg0: Time) => void;
  currentTime?: Time;
  startTime?: Time;
  endTime?: Time;
  isPlaying?: boolean;
  pauseFrame?: (arg0: string) => () => void;
  playerId?: string;
  progress?: Progress;
  urlState?: PlayerURLState;
  /* eslint-enable react/no-unused-prop-types */
};
type MockMessagePipelineState = MessagePipelineInternalState & {
  mockProps: MockMessagePipelineProps;
  dispatch: (
    action:
      | MessagePipelineStateAction
      | { type: "set-mock-props"; mockProps: MockMessagePipelineProps },
  ) => void;
};

function getPublicState(
  prevState: MockMessagePipelineState | undefined,
  props: MockMessagePipelineProps,
  dispatch: MockMessagePipelineState["dispatch"],
  promisesToWaitForRef: MutableRefObject<FramePromise[]>,
): Omit<MessagePipelineInternalState["public"], "messageEventsBySubscriberId"> {
  let startTime = prevState?.public.playerState.activeData?.startTime;
  let currentTime = props.currentTime;
  if (!currentTime) {
    for (const message of props.messages ?? []) {
      if (startTime == undefined || isLessThan(message.receiveTime, startTime)) {
        startTime = message.receiveTime;
      }
      if (!currentTime || isLessThan(currentTime, message.receiveTime)) {
        currentTime = message.receiveTime;
      }
    }
  }

  return {
    playerState: {
      name: props.name,
      presence: props.presence ?? PlayerPresence.PRESENT,
      playerId: props.playerId ?? "1",
      progress: props.progress ?? {},
      capabilities: props.capabilities ?? prevState?.public.playerState.capabilities ?? [],
      profile: props.profile,
      problems: props.problems,
      urlState: props.urlState,
      activeData:
        props.noActiveData === true
          ? undefined
          : {
              messages: props.messages ?? [],
              topics: props.topics ?? [],
              topicStats: props.topicStats ?? new Map(),
              datatypes: props.datatypes ?? NO_DATATYPES,
              startTime: props.startTime ?? startTime ?? { sec: 100, nsec: 0 },
              currentTime: currentTime ?? { sec: 100, nsec: 0 },
              endTime: props.endTime ?? currentTime ?? { sec: 100, nsec: 0 },
              isPlaying: props.isPlaying ?? false,
              speed: 0.2,
              lastSeekTime: 0,
              totalBytesReceived: 0,
              ...props.activeData,
            },
    },
    subscriptions: [],
    sortedTopics:
      props.topics === prevState?.mockProps.topics
        ? prevState?.public.sortedTopics ?? []
        : props.topics
        ? [...props.topics].sort((a, b) => a.name.localeCompare(b.name))
        : [],
    datatypes: props.datatypes ?? NO_DATATYPES,
    setSubscriptions:
      (props.setSubscriptions === prevState?.mockProps.setSubscriptions
        ? prevState?.public.setSubscriptions
        : undefined) ??
      ((id, payloads) => {
        dispatch({ type: "update-subscriber", id, payloads });
        props.setSubscriptions?.(id, payloads);
      }),
    setPublishers:
      (props.setPublishers === prevState?.mockProps.setPublishers
        ? prevState?.public.setPublishers
        : undefined) ??
      ((id, payloads) => {
        dispatch({ type: "set-publishers", id, payloads });
        props.setPublishers?.(id, payloads);
      }),
    setParameter: props.setParameter ?? noop,
    publish: props.publish ?? noop,
    callService: props.callService ?? (async () => {}),
    fetchAsset:
      props.fetchAsset ??
      (async () => {
        throw new Error(`not supported`);
      }),
    startPlayback: props.startPlayback,
    playUntil: noop,
    pausePlayback: props.pausePlayback,
    setPlaybackSpeed:
      props.capabilities?.includes(PlayerCapabilities.setSpeed) === true ? noop : undefined,
    seekPlayback: props.seekPlayback,

    pauseFrame:
      props.pauseFrame ??
      function (name) {
        const condvar = new Condvar();
        promisesToWaitForRef.current.push({ name, promise: condvar.wait() });
        return () => {
          condvar.notifyAll();
        };
      },
  };
}

export default function MockMessagePipelineProvider(
  props: React.PropsWithChildren<MockMessagePipelineProps>,
): React.ReactElement {
  const promisesToWaitForRef = useRef<FramePromise[]>([]);
  const startTime = useRef<Time | undefined>();
  let currentTime = props.currentTime;
  if (!currentTime) {
    for (const message of props.messages ?? []) {
      if (startTime.current == undefined || isLessThan(message.receiveTime, startTime.current)) {
        startTime.current = message.receiveTime;
      }
      if (!currentTime || isLessThan(currentTime, message.receiveTime)) {
        currentTime = message.receiveTime;
      }
    }
  }

  const [hasSubscribers, setHasSubscribers] = useState<boolean>(false);

  const mockProps = useMemo(() => {
    // only include messages in props once we have subscribers, to reflect actual behavior of player
    // and to prevent messages from being emitted before subscribers are set, so that they can go to their respective subscribers
    if (hasSubscribers) {
      const propsNoChildren = _.omit(props, "children");
      // mimic seek backfill behavior that happens after new subscribers are added.
      // note that for the mock use-case that this will only happen the first time subscribers are added, since we don't reset `hasSubscribers`
      if (props.noActiveData === true) {
        return propsNoChildren;
      }
      const activeData = {
        ...propsNoChildren.activeData,
      };

      activeData.lastSeekTime = (activeData.lastSeekTime ?? 0) + 1;

      return {
        ...propsNoChildren,
        activeData,
      };
    }
    return _.omit(props, ["children", "messages"]);
  }, [props, hasSubscribers]);

  const [store] = useState(() =>
    createStore<MockMessagePipelineState>((set) => {
      const dispatch: MockMessagePipelineState["dispatch"] = async (action) => {
        const promisesToWaitFor = promisesToWaitForRef.current;
        if (promisesToWaitFor.length > 0) {
          await pauseFrameForPromises(promisesToWaitFor);
          // normally in the player listener this comes before the await, but when working with stories this hasn't been enough
          // so for this case we'll wait until all promises have resolved before clearing them
          promisesToWaitForRef.current = [];
        }

        if (action.type === "set-mock-props") {
          set((state) => {
            const actionMockProps = action.mockProps;
            if (shallowequal(state.mockProps, actionMockProps)) {
              return state;
            }
            const publicState = getPublicState(
              state,
              actionMockProps,
              state.dispatch,
              promisesToWaitForRef,
            );
            const newState = reducer(state, {
              type: "update-player-state",
              playerState: publicState.playerState as Writable<PlayerState>,
            });
            return {
              ...newState,
              mockProps: actionMockProps,
              dispatch: state.dispatch,
              public: {
                ...publicState,
                messageEventsBySubscriberId: newState.public.messageEventsBySubscriberId,
              },
            };
          });
        } else {
          set((state) => {
            const newState = reducer(state, action);

            if (
              !hasSubscribers &&
              action.type === "update-subscriber" &&
              action.payloads.length > 0
            ) {
              setHasSubscribers(true);
            }

            return { ...newState, dispatch: state.dispatch };
          });
        }
      };
      const reset = () => {
        throw new Error("not implemented");
      };

      const initialPublicState = getPublicState(
        undefined,
        mockProps,
        dispatch,
        promisesToWaitForRef,
      );
      return {
        mockProps,
        player: undefined,
        dispatch,
        reset,
        subscriptionMemoizer: makeSubscriptionMemoizer(),
        publishersById: {},
        allPublishers: [],
        subscriptionsById: new Map(),
        subscriberIdsByTopic: new Map(),
        newTopicsBySubscriberId: new Map(),
        lastMessageEventByTopic: new Map(),
        lastCapabilities: [...initialPublicState.playerState.capabilities],
        public: {
          ...initialPublicState,
          messageEventsBySubscriberId: new Map(),
        },
      };
    }),
  );

  // Can't be useLayoutEffect because we want child useEffect calls to resolve first to set subscribers
  // That way we can call `set-mock-props` after subscribers have been set, and we can emit messages that were subscribed to
  // If we `useLayoutEffect`, it will emit the initial messages with no subscribers set, which is not consistent with the real behavior
  useEffect(() => {
    store.getState().dispatch({ type: "set-mock-props", mockProps });
  }, [mockProps, store]);

  return <ContextInternal.Provider value={store}>{props.children}</ContextInternal.Provider>;
}
