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

import { debounce, flatten } from "lodash";

import { Condvar } from "@foxglove/den/async";
import { useShallowMemo } from "@foxglove/hooks";
import { Time } from "@foxglove/rostime";
import { MessageEvent, ParameterValue } from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useContextSelector from "@foxglove/studio-base/hooks/useContextSelector";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import useSelectableContextGetter from "@foxglove/studio-base/hooks/useSelectableContextGetter";
import {
  AdvertiseOptions,
  Player,
  PlayerCapabilities,
  PlayerPresence,
  PlayerProblem,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import createSelectableContext from "@foxglove/studio-base/util/createSelectableContext";

import MessageOrderTracker from "./MessageOrderTracker";
import { pauseFrameForPromises, FramePromise } from "./pauseFrameForPromise";
import { MessagePipelineStateAction, usePlayerState } from "./usePlayerState";

const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

type ResumeFrame = () => void;
export type MessagePipelineContext = {
  playerState: PlayerState;
  sortedTopics: Topic[];
  datatypes: RosDatatypes;
  subscriptions: SubscribePayload[];
  publishers: AdvertiseOptions[];
  messageEventsBySubscriberId: Map<string, MessageEvent<unknown>[]>;
  setSubscriptions: (id: string, subscriptionsForId: SubscribePayload[]) => void;
  setPublishers: (id: string, publishersForId: AdvertiseOptions[]) => void;
  setParameter: (key: string, value: ParameterValue) => void;
  publish: (request: PublishPayload) => void;
  callService: (service: string, request: unknown) => Promise<unknown>;
  startPlayback?: () => void;
  pausePlayback?: () => void;
  setPlaybackSpeed?: (speed: number) => void;
  seekPlayback?: (time: Time) => void;
  // Don't render the next frame until the returned function has been called.
  pauseFrame: (name: string) => ResumeFrame;
  requestBackfill: () => void;
};

// exported only for MockMessagePipelineProvider
export const ContextInternal = createSelectableContext<MessagePipelineContext>();
ContextInternal.displayName = "MessagePipelineContext";

/**
 * useMessagePipelineGetter returns a function to access the current message pipeline context.
 * Commonly used in places where you want to access a value from the latest pipeline in a useCallback hook
 * but don't want the callback dependencies invalidated on ever change.
 *
 * @returns a function to return the current MessagePipelineContext
 */
export function useMessagePipelineGetter(): () => MessagePipelineContext {
  return useSelectableContextGetter(ContextInternal);
}

export function useMessagePipeline<T>(selector: (arg0: MessagePipelineContext) => T): T {
  return useContextSelector(ContextInternal, selector);
}

function defaultPlayerState(): PlayerState {
  return {
    presence: PlayerPresence.NOT_PRESENT,
    progress: {},
    capabilities: [],
    profile: undefined,
    playerId: "",
    activeData: undefined,
  };
}

type ProviderProps = {
  children: React.ReactNode;

  // Represents either the lack of a player, a player that is currently being constructed, or a
  // valid player. MessagePipelineProvider is not responsible for building players, but it is
  // responsible for providing player state information downstream in a context -- so this
  // information is passed in and merged with other player state.
  player?: Player;

  globalVariables: GlobalVariables;
};

export function MessagePipelineProvider({
  children,
  player,
  globalVariables,
}: ProviderProps): React.ReactElement {
  const [publishersById, setAllPublishers] = useState({});

  const promisesToWaitForRef = useRef<FramePromise[]>([]);

  const [state, updateState] = usePlayerState();

  const subscriptions: SubscribePayload[] = useMemo(
    () => flatten(Array.from(state.subscriptionsById.values())),
    [state.subscriptionsById],
  );
  const publishers: AdvertiseOptions[] = useMemo(
    () => flatten(Object.values(publishersById)),
    [publishersById],
  );
  useEffect(() => player?.setSubscriptions(subscriptions), [player, subscriptions]);
  useEffect(() => player?.setPublishers(publishers), [player, publishers]);

  // Slow down the message pipeline framerate to the given FPS if it is set to less than 60
  const [messageRate] = useAppConfigurationValue<number>(AppSetting.MESSAGE_RATE);

  // Tell listener the layout has completed
  const signalRenderDone = state.renderDone;
  useLayoutEffect(() => {
    signalRenderDone?.();
  }, [signalRenderDone]);

  const msPerFrameRef = useRef<number>(16);
  msPerFrameRef.current = 1000 / (messageRate ?? 60);

  useEffect(() => {
    if (!player) {
      return;
    }

    const { listener, cleanupListener } = createPlayerListener({
      msPerFrameRef,
      promisesToWaitForRef,
      updateState,
    });
    player.setListener(listener);
    return () => {
      cleanupListener();
      player.close();
      updateState({
        type: "update-player-state",
        playerState: defaultPlayerState(),
        renderDone: undefined,
      });
    };
  }, [player, updateState]);

  const topics: Topic[] | undefined = useShallowMemo(state.playerState.activeData?.topics);
  const sortedTopics = useMemo(() => (topics ?? []).sort(), [topics]);
  const datatypes: RosDatatypes = useMemo(
    () => state.playerState.activeData?.datatypes ?? new Map(),
    [state.playerState.activeData?.datatypes],
  );

  const capabilities = useShallowMemo(state.playerState.capabilities);
  const setSubscriptions = useCallback(
    (id: string, payloads: SubscribePayload[]) => {
      updateState({ type: "update-subscriber", id, payloads });
    },
    [updateState],
  );
  const setPublishers = useCallback(
    (id: string, publishersForId: AdvertiseOptions[]) => {
      setAllPublishers((p) => ({ ...p, [id]: publishersForId }));
    },
    [setAllPublishers],
  );
  const setParameter = useCallback(
    (key: string, value: ParameterValue) => (player ? player.setParameter(key, value) : undefined),
    [player],
  );
  const publish = useCallback(
    (request: PublishPayload) => (player ? player.publish(request) : undefined),
    [player],
  );
  const callService = useCallback(
    async (service: string, request: unknown) =>
      await (player ? player.callService(service, request) : Promise.reject()),
    [player],
  );
  const startPlayback = useMemo(
    () =>
      capabilities.includes(PlayerCapabilities.playbackControl)
        ? player?.startPlayback?.bind(player)
        : undefined,
    [player, capabilities],
  );
  const pausePlayback = useMemo(
    () =>
      capabilities.includes(PlayerCapabilities.playbackControl)
        ? player?.pausePlayback?.bind(player)
        : undefined,
    [player, capabilities],
  );
  const seekPlayback = useMemo(
    () =>
      capabilities.includes(PlayerCapabilities.playbackControl)
        ? player?.seekPlayback?.bind(player)
        : undefined,
    [player, capabilities],
  );
  const setPlaybackSpeed = useMemo(
    () =>
      capabilities.includes(PlayerCapabilities.setSpeed)
        ? player?.setPlaybackSpeed?.bind(player)
        : undefined,
    [player, capabilities],
  );
  const pauseFrame = useCallback((name: string) => {
    const condvar = new Condvar();
    promisesToWaitForRef.current.push({ name, promise: condvar.wait() });
    return () => {
      condvar.notifyAll();
    };
  }, []);
  const requestBackfill = useMemo(
    () => debounce(() => (player ? player.requestBackfill() : undefined)),
    [player],
  );

  useEffect(() => {
    player?.setGlobalVariables(globalVariables);
  }, [player, globalVariables]);

  return (
    <ContextInternal.Provider
      value={useShallowMemo({
        playerState: state.playerState,
        messageEventsBySubscriberId: state.messagesBySubscriberId,
        subscriptions,
        publishers,
        sortedTopics,
        datatypes,
        setSubscriptions,
        setPublishers,
        setParameter,
        publish,
        callService,
        startPlayback,
        pausePlayback,
        setPlaybackSpeed,
        seekPlayback,
        pauseFrame,
        requestBackfill,
      })}
    >
      {children}
    </ContextInternal.Provider>
  );
}

// Given a PlayerState and a PlayerProblem array, add the problems to any existing player problems
function concatProblems(origState: PlayerState, problems: PlayerProblem[]): PlayerState {
  if (problems.length === 0) {
    return origState;
  }

  return {
    ...origState,
    problems: problems.concat(origState.problems ?? []),
  };
}

/**
 * The creation of the player listener is extracted as a separate function to prevent memory leaks.
 * When multiple closures are created inside of an outer function, V8 allocates one "context" object
 * to be shared by all the inner closures, holding the shared variables they access. As long as any
 * of the inner closures are still alive, the context and **all** the shared variables stay alive.
 *
 * In the case of MessagePipelineProvider, when the `listener` closure was created directly inside
 * the useEffect above, it would end up retaining a shared context that also retained the player
 * `state` variable returned by `usePlayerState()`, even though the listener closure didn't actually
 * use it. In particular, each time a new player was created in the useEffect, this caused it to
 * retain the old player's state (via the listener closure), creating a "linked list" effect that
 * caused the last state produced by each player (and therefore also its preloaded message blocks)
 * to be retained indefinitely as new data sources were swapped in.
 *
 * To avoid this problem, we extract the closure creation into a module-level function where it
 * won't see variables from outer scopes that are potentially retained in the shared context due to
 * their use in other closures.
 *
 * This type of leak is discussed at:
 * - https://bugs.chromium.org/p/chromium/issues/detail?id=315190
 * - http://point.davidglasser.net/2013/06/27/surprising-javascript-memory-leak.html
 * - https://stackoverflow.com/questions/53985411/understanding-javascript-closure-variable-capture-in-v8
 */
function createPlayerListener(args: {
  msPerFrameRef: React.MutableRefObject<number>;
  promisesToWaitForRef: React.MutableRefObject<FramePromise[]>;
  updateState: (action: MessagePipelineStateAction) => void;
}): {
  listener: (state: PlayerState) => Promise<void>;
  cleanupListener: () => void;
} {
  const { msPerFrameRef, promisesToWaitForRef, updateState } = args;
  const messageOrderTracker = new MessageOrderTracker();
  let closed = false;
  let resolveFn: undefined | (() => void);
  const listener = async (listenerPlayerState: PlayerState) => {
    if (closed) {
      return;
    }

    if (resolveFn) {
      throw new Error("New playerState was emitted before last playerState was rendered.");
    }

    // check for any out-of-order or out-of-sync messages
    const problems = messageOrderTracker.update(listenerPlayerState);
    const newPlayerState = concatProblems(listenerPlayerState, problems);

    const promise = new Promise<void>((resolve) => {
      resolveFn = () => {
        resolveFn = undefined;
        resolve();
      };
    });

    // Track when we start the state update. This will pair when layout effect calls renderDone.
    const start = Date.now();

    // Render done is invoked by a layout effect once the component has rendered.
    // After the component renders, we kick off an animation frame to give panels one
    // animation frame to invoke pause.
    let called = false;
    function renderDone() {
      if (called) {
        return;
      }
      called = true;

      // Compute how much time remains before this frame is done
      const delta = Date.now() - start;
      const frameTime = Math.max(0, msPerFrameRef.current - delta);

      // Panels have the remaining frame time to invoke pause
      setTimeout(async () => {
        if (closed) {
          return;
        }

        const promisesToWaitFor = promisesToWaitForRef.current;
        if (promisesToWaitFor.length > 0) {
          promisesToWaitForRef.current = [];
          await pauseFrameForPromises(promisesToWaitFor);
        }

        if (!resolveFn) {
          return;
        }
        resolveFn();
      }, frameTime);
    }

    updateState({
      type: "update-player-state",
      playerState: newPlayerState,
      renderDone,
    });

    return await promise;
  };
  return {
    listener,
    cleanupListener() {
      closed = true;
      resolveFn = undefined;
    },
  };
}
