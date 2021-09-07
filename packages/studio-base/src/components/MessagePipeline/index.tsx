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

import { debounce, flatten, groupBy } from "lodash";

import { useShallowMemo } from "@foxglove/hooks";
import { Time } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useContextSelector from "@foxglove/studio-base/hooks/useContextSelector";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import useSelectableContextGetter from "@foxglove/studio-base/hooks/useSelectableContextGetter";
import {
  AdvertiseOptions,
  Frame,
  ParameterValue,
  Player,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import createSelectableContext from "@foxglove/studio-base/util/createSelectableContext";
import { requestThrottledAnimationFrame } from "@foxglove/studio-base/util/requestThrottledAnimationFrame";
import signal from "@foxglove/studio-base/util/signal";

import { pauseFrameForPromises, FramePromise } from "./pauseFrameForPromise";
import warnOnOutOfSyncMessages from "./warnOnOutOfSyncMessages";

const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

type ResumeFrame = () => void;
export type MessagePipelineContext = {
  playerState: PlayerState;
  frame: Frame;
  sortedTopics: Topic[];
  datatypes: RosDatatypes;
  subscriptions: SubscribePayload[];
  publishers: AdvertiseOptions[];
  setSubscriptions: (id: string, subscriptionsForId: SubscribePayload[]) => void;
  setPublishers: (id: string, publishersForId: AdvertiseOptions[]) => void;
  setParameter: (key: string, value: ParameterValue) => void;
  publish: (request: PublishPayload) => void;
  startPlayback: () => void;
  pausePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  seekPlayback: (time: Time) => void;
  // Don't render the next frame until the returned function has been called.
  pauseFrame: (name: string) => ResumeFrame;
  requestBackfill: () => void;
};

// exported only for MockMessagePipelineProvider
export const ContextInternal = createSelectableContext<MessagePipelineContext>();

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
  const currentPlayer = useRef<Player | undefined>(undefined);
  const [rawPlayerState, setRawPlayerState] = useState<PlayerState>(defaultPlayerState);
  const lastActiveData = useRef<PlayerStateActiveData | undefined>(rawPlayerState.activeData);
  const lastTimeWhenActiveDataBecameSet = useRef<number | undefined>();
  const [subscriptionsById, setAllSubscriptions] = useState<{
    [key: string]: SubscribePayload[];
  }>({});
  const [publishersById, setAllPublishers] = useState({});
  // This is the state of the current tick of the player.
  // This state is tied to the player, and should be replaced whenever the player changes.
  const playerTickState = useRef<{
    // Call this to resolve the current tick. If this doesn't exist, there isn't a tick currently rendering.
    resolveFn?: () => void;
    // Promises to halt the current tick for.
    promisesToWaitFor: FramePromise[];
    waitingForPromises: boolean;
  }>({ resolveFn: undefined, promisesToWaitFor: [], waitingForPromises: false });

  const subscriptions: SubscribePayload[] = useMemo(
    () => flatten(Object.values(subscriptionsById)),
    [subscriptionsById],
  );
  const publishers: AdvertiseOptions[] = useMemo(
    () => flatten(Object.values(publishersById)),
    [publishersById],
  );
  useEffect(() => player?.setSubscriptions(subscriptions), [player, subscriptions]);
  useEffect(() => player?.setPublishers(publishers), [player, publishers]);

  // Slow down the message pipeline framerate to the given FPS if it is set to less than 60
  const [messageRate] = useAppConfigurationValue<number>(AppSetting.MESSAGE_RATE);
  const skipFrames = 60 / (messageRate ?? 60) - 1;

  // Delay the player listener promise until rendering has finished for the latest data.
  useLayoutEffect(() => {
    // In certain cases like the player being replaced (reproduce by dragging a bag in while playing), we can
    // replace the new playerTickState. We want to use one playerTickState throughout the entire tick, since it's
    // implicitly tied to the player.
    const currentPlayerTickState = playerTickState.current;
    requestThrottledAnimationFrame(async () => {
      if (currentPlayerTickState.resolveFn && !currentPlayerTickState.waitingForPromises) {
        if (currentPlayerTickState.promisesToWaitFor.length > 0) {
          // If we have finished rendering but we still have to wait for some promises wait for them here.

          const promises = currentPlayerTickState.promisesToWaitFor;
          currentPlayerTickState.promisesToWaitFor = [];
          currentPlayerTickState.waitingForPromises = true;
          // If `pauseFrame` is called while we are waiting for any other promises, they just wait for the frame
          // after the current one.
          await pauseFrameForPromises(promises);

          currentPlayerTickState.waitingForPromises = false;
          // https://github.com/microsoft/TypeScript/issues/43781
          // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
          if (currentPlayerTickState.resolveFn) {
            currentPlayerTickState.resolveFn();
            currentPlayerTickState.resolveFn = undefined;
          }
        } else {
          currentPlayerTickState.resolveFn();
          currentPlayerTickState.resolveFn = undefined;
        }
      }
    }, skipFrames);
  }, [rawPlayerState, skipFrames]);

  useEffect(() => {
    currentPlayer.current = player;
    if (!player) {
      return;
    }
    // Create a new PlayerTickState when the player is replaced.
    playerTickState.current = {
      resolveFn: undefined,
      promisesToWaitFor: [],
      waitingForPromises: false,
    };

    player.setListener(async (newPlayerState: PlayerState) => {
      warnOnOutOfSyncMessages(newPlayerState);
      if (currentPlayer.current !== player) {
        return undefined;
      }
      if (playerTickState.current.resolveFn) {
        throw new Error("New playerState was emitted before last playerState was rendered.");
      }

      const promise = new Promise<void>((resolve) => {
        playerTickState.current.resolveFn = resolve;
      });
      setRawPlayerState((currentPlayerState) => {
        if (currentPlayer.current !== player) {
          // It's unclear how we can ever get here, but it looks like React
          // doesn't properly order the `setRawPlayerState` call below. So we
          // need this additional check. Unfortunately this is hard to test,
          // so please make sure to manually test having an active player and
          // disconnecting from it when changing this code. Without this line
          // it will show the player as being in an active state even after
          // explicitly disconnecting it.
          return currentPlayerState;
        }
        if (!lastActiveData.current && newPlayerState.activeData) {
          lastTimeWhenActiveDataBecameSet.current = Date.now();
        }
        lastActiveData.current = newPlayerState.activeData;
        return newPlayerState;
      });

      return await promise;
    });
    return () => {
      currentPlayer.current = playerTickState.current.resolveFn = undefined;
      player.close();
      setRawPlayerState({
        ...defaultPlayerState(),
        activeData: lastActiveData.current,
      });
    };
  }, [player]);

  const topics: Topic[] | undefined = useShallowMemo(rawPlayerState.activeData?.topics);
  const messages: readonly MessageEvent<unknown>[] | undefined =
    rawPlayerState.activeData?.messages;
  const frame = useMemo(() => groupBy(messages ?? [], "topic"), [messages]);
  const sortedTopics = useMemo(() => (topics ?? []).sort(), [topics]);
  const datatypes: RosDatatypes = useMemo(
    () => rawPlayerState.activeData?.datatypes ?? new Map(),
    [rawPlayerState.activeData?.datatypes],
  );
  const setSubscriptions = useCallback(
    (id: string, subscriptionsForId: SubscribePayload[]) => {
      setAllSubscriptions((previousSubscriptions) => {
        return { ...previousSubscriptions, [id]: subscriptionsForId };
      });
    },
    [setAllSubscriptions],
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
  const startPlayback = useCallback(() => (player ? player.startPlayback() : undefined), [player]);
  const pausePlayback = useCallback(() => (player ? player.pausePlayback() : undefined), [player]);
  const setPlaybackSpeed = useCallback(
    (speed: number) => (player ? player.setPlaybackSpeed(speed) : undefined),
    [player],
  );
  const seekPlayback = useCallback(
    (time: Time) => (player ? player.seekPlayback(time) : undefined),
    [player],
  );
  const pauseFrame = useCallback((name: string) => {
    const promise = signal();
    playerTickState.current.promisesToWaitFor.push({ name, promise });
    return () => {
      promise.resolve();
    };
  }, []);
  const requestBackfill = useMemo(
    () => debounce(() => (player ? player.requestBackfill() : undefined)),
    [player],
  );

  React.useEffect(() => {
    let skipUpdate = false;
    void (async () => {
      // Wait for the current frame to finish rendering if needed
      await pauseFrameForPromises(playerTickState.current.promisesToWaitFor ?? []);

      // If the globalVariables have already changed again while
      // we waited for the frame to render, skip the update.
      if (!skipUpdate && currentPlayer.current) {
        currentPlayer.current.setGlobalVariables(globalVariables);
      }
    })();
    return () => {
      skipUpdate = true;
    };
  }, [globalVariables]);
  return (
    <ContextInternal.Provider
      value={useShallowMemo({
        playerState: rawPlayerState,
        subscriptions,
        publishers,
        frame,
        sortedTopics,
        datatypes,
        setSubscriptions,
        setPublishers,
        setParameter,
        publish,
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
