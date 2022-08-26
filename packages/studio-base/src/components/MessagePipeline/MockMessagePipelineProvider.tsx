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

import { flatten } from "lodash";
import { useCallback, useMemo, useRef, useState } from "react";
import { useLatest } from "react-use";

import { useShallowMemo } from "@foxglove/hooks";
import { Time, isLessThan } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import {
  AdvertiseOptions,
  MessageEvent,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
  PlayerProblem,
  Progress,
  PublishPayload,
  SubscribePayload,
  Topic,
  PlayerURLState,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import naturalSort from "@foxglove/studio-base/util/naturalSort";

import { ContextInternal } from "./index";

const NO_DATATYPES = new Map();

function noop() {}

export default function MockMessagePipelineProvider(props: {
  children: React.ReactNode;
  presence?: PlayerPresence;
  topics?: Topic[];
  topicStats?: Map<string, TopicStats>;
  datatypes?: RosDatatypes;
  messages?: MessageEvent<unknown>[];
  problems?: PlayerProblem[];
  publish?: (request: PublishPayload) => void;
  callService?: (service: string, request: unknown) => Promise<unknown>;
  setPublishers?: (arg0: string, arg1: AdvertiseOptions[]) => void;
  setSubscriptions?: (arg0: string, arg1: SubscribePayload[]) => void;
  setParameter?: (key: string, value: ParameterValue) => void;
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
}): React.ReactElement {
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

  // See comment for messageEventsBySubscriberId below on the purpose of this ref
  const firstChangeRef = useRef<boolean>(false);

  const [allSubscriptions, setAllSubscriptions] = useState<{
    [key: string]: SubscribePayload[];
  }>({});
  const flattenedSubscriptions: SubscribePayload[] = useMemo(
    () => flatten(Object.values(allSubscriptions)),
    [allSubscriptions],
  );
  const setSubscriptions = useCallback(
    (id: string, subs: SubscribePayload[]) => {
      setAllSubscriptions((sub) => ({ ...sub, [id]: subs }));
      const setSubs = props.setSubscriptions;
      setSubs?.(id, subs);
      if (subs.length > 0) {
        firstChangeRef.current = true;
      }
    },
    [setAllSubscriptions, props.setSubscriptions],
  );

  const capabilities = useShallowMemo(props.capabilities ?? []);

  const playerState = useMemo<PlayerState>(
    () => ({
      presence: props.presence ?? PlayerPresence.PRESENT,
      playerId: props.playerId ?? "1",
      progress: props.progress ?? {},
      capabilities,
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
              startTime: props.startTime ?? startTime.current ?? { sec: 100, nsec: 0 },
              currentTime: currentTime ?? { sec: 100, nsec: 0 },
              endTime: props.endTime ?? currentTime ?? { sec: 100, nsec: 0 },
              isPlaying: props.isPlaying ?? false,
              speed: 0.2,
              lastSeekTime: 0,
              totalBytesReceived: 0,
              ...props.activeData,
            },
    }),
    [
      props.presence,
      props.playerId,
      props.progress,
      props.profile,
      props.problems,
      props.urlState,
      props.noActiveData,
      props.messages,
      props.topics,
      props.topicStats,
      props.datatypes,
      props.startTime,
      props.endTime,
      props.isPlaying,
      props.activeData,
      capabilities,
      currentTime,
    ],
  );

  // In the real pipeline, the messageEventsBySubscriberId only change
  // on player listener callback - not on subscriber changes
  //
  // In tests, the first setSubscriptions call happens after we've already set props.messages
  // So we have some special logic to detect the _first_ change of subscriptions
  // and update messageEventsBySubscriberId.
  const latestAllSubs = useLatest(allSubscriptions);
  const firstChange = firstChangeRef.current;
  const messageEventsBySubscriberId = useMemo(() => {
    void firstChange;
    return new Map(
      Object.entries(latestAllSubs.current).map(([id, payloads]) => [
        id,
        props.messages?.filter((msg) => payloads.find((payload) => payload.topic === msg.topic)) ??
          [],
      ]),
    );
  }, [firstChange, props.messages, latestAllSubs]);

  return (
    <ContextInternal.Provider
      value={{
        playerState,
        sortedTopics: (props.topics ?? []).sort(naturalSort("name")),
        datatypes: props.datatypes ?? NO_DATATYPES,
        subscriptions: flattenedSubscriptions,
        publishers: [],
        messageEventsBySubscriberId,
        setSubscriptions,
        setPublishers: props.setPublishers ?? noop,
        setParameter: props.setParameter ?? noop,
        publish: props.publish ?? noop,
        callService: props.callService ?? (async () => await Promise.reject()),
        startPlayback: props.startPlayback ?? noop,
        pausePlayback: props.pausePlayback ?? noop,
        setPlaybackSpeed: noop,
        seekPlayback: props.seekPlayback ?? noop,
        pauseFrame: props.pauseFrame ?? (() => noop),
      }}
    >
      {props.children}
    </ContextInternal.Provider>
  );
}
