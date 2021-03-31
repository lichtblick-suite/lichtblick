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

import { debounce, flatten, groupBy, isEqual } from "lodash";
import { Time } from "rosbag";

import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import {
  AdvertisePayload,
  Frame,
  Message,
  Player,
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove-studio/app/players/types";
import signal from "@foxglove-studio/app/shared/signal";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { objectValues } from "@foxglove-studio/app/util";
import {
  createSelectableContext,
  useContextSelector,
  useShallowMemo,
  useShouldNotChangeOften,
} from "@foxglove-studio/app/util/hooks";
import sendNotification from "@foxglove-studio/app/util/sendNotification";

import { pauseFrameForPromises, FramePromise } from "./pauseFrameForPromise";
import warnOnOutOfSyncMessages from "./warnOnOutOfSyncMessages";

export const WARN_ON_SUBSCRIPTIONS_WITHIN_TIME_MS = 1000;

const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

type ResumeFrame = () => void;
export type MessagePipelineContext = {
  playerState: PlayerState;
  frame: Frame;
  sortedTopics: Topic[];
  datatypes: RosDatatypes;
  subscriptions: SubscribePayload[];
  publishers: AdvertisePayload[];
  setSubscriptions: (id: string, subscriptionsForId: SubscribePayload[]) => void;
  setPublishers: (id: string, publishersForId: AdvertisePayload[]) => void;
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

export function useMessagePipeline<T>(
  selector: (arg0: MessagePipelineContext) => T | typeof useContextSelector.BAILOUT,
): T {
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

export type MaybePlayer<P extends Player = Player> =
  | { loading: true; error?: undefined; player?: undefined }
  | { loading?: false; error: Error; player?: undefined }
  | { loading?: false; error?: undefined; player?: P };

type ProviderProps = {
  children: React.ReactNode;

  // Represents either the lack of a player, a player that is currently being constructed, or a
  // valid player. MessagePipelineProvider is not responsible for building players, but it is
  // responsible for providing player state information downstream in a context -- so this
  // information is passed in and merged with other player state.
  maybePlayer?: MaybePlayer;

  globalVariables?: GlobalVariables;
};
export function MessagePipelineProvider({
  children,
  maybePlayer = {},
  globalVariables = {},
}: ProviderProps): React.ReactElement {
  const currentPlayer = useRef<Player | undefined>(undefined);
  const [rawPlayerState, setRawPlayerState] = useState<PlayerState>(defaultPlayerState);
  const playerState = useMemo(() => {
    // Use the MaybePlayer's status if we do not yet have a player to report presence.
    if (rawPlayerState.presence === PlayerPresence.NOT_PRESENT) {
      return {
        ...rawPlayerState,
        presence: maybePlayer.loading
          ? PlayerPresence.CONSTRUCTING
          : maybePlayer.error
          ? PlayerPresence.ERROR
          : maybePlayer.player
          ? PlayerPresence.INITIALIZING
          : PlayerPresence.NOT_PRESENT,
      };
    }
    return rawPlayerState;
  }, [maybePlayer, rawPlayerState]);
  const lastActiveData = useRef<PlayerStateActiveData | undefined>(playerState.activeData);
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
    () => flatten(objectValues(subscriptionsById)),
    [subscriptionsById],
  );
  const publishers: AdvertisePayload[] = useMemo(() => flatten(objectValues(publishersById)), [
    publishersById,
  ]);
  const player = maybePlayer.player;
  useEffect(() => player?.setSubscriptions(subscriptions), [player, subscriptions]);
  useEffect(() => player?.setPublishers(publishers), [player, publishers]);

  useEffect(() => {
    const error = maybePlayer.error;
    if (error) {
      sendNotification("Connection error", error, "user", "error");
    }
  }, [maybePlayer.error]);

  // Delay the player listener promise until rendering has finished for the latest data.
  useLayoutEffect(() => {
    if (playerTickState.current) {
      // In certain cases like the player being replaced (reproduce by dragging a bag in while playing), we can
      // replace the new playerTickState. We want to use one playerTickState throughout the entire tick, since it's
      // implicitly tied to the player.
      const currentPlayerTickState = playerTickState.current;
      requestAnimationFrame(async () => {
        if (currentPlayerTickState.resolveFn && !currentPlayerTickState.waitingForPromises) {
          if (currentPlayerTickState.promisesToWaitFor.length) {
            // If we have finished rendering but we still have to wait for some promises wait for them here.

            const promises = currentPlayerTickState.promisesToWaitFor;
            currentPlayerTickState.promisesToWaitFor = [];
            currentPlayerTickState.waitingForPromises = true;
            // If `pauseFrame` is called while we are waiting for any other promises, they just wait for the frame
            // after the current one.
            await pauseFrameForPromises(promises);

            currentPlayerTickState.waitingForPromises = false;
            if (currentPlayerTickState.resolveFn) {
              currentPlayerTickState.resolveFn();
              currentPlayerTickState.resolveFn = undefined;
            }
          } else {
            currentPlayerTickState.resolveFn();
            currentPlayerTickState.resolveFn = undefined;
          }
        }
      });
    }
  }, [playerState]);

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

    player.setListener((newPlayerState: PlayerState): any => {
      warnOnOutOfSyncMessages(newPlayerState);
      if (currentPlayer.current !== player) {
        return Promise.resolve();
      }
      if (playerTickState.current.resolveFn) {
        throw new Error("New playerState was emitted before last playerState was rendered.");
      }

      const promise = new Promise((resolve) => {
        playerTickState.current.resolveFn = resolve as any;
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
      return promise;
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

  const topics: Topic[] | undefined = playerState.activeData?.topics;
  useShouldNotChangeOften(topics, () => {
    sendNotification(
      "Provider topics should not change often",
      "If they do they are probably not memoized properly. Please let the Foxglove team know if you see this warning.",
      "app",
      "warn",
    );
  });

  const unmemoizedDatatypes: RosDatatypes | undefined = playerState.activeData?.datatypes;
  const messages: readonly Message[] | undefined = playerState.activeData?.messages;
  const frame = useMemo(() => groupBy(messages ?? [], "topic"), [messages]);
  const sortedTopics = useMemo(() => (topics ?? []).sort(), [topics]);
  const datatypes: RosDatatypes = useMemo(() => unmemoizedDatatypes ?? {}, [unmemoizedDatatypes]);
  const setSubscriptions = useCallback(
    (id: string, subscriptionsForId: SubscribePayload[]) => {
      setAllSubscriptions((s) => {
        if (
          lastTimeWhenActiveDataBecameSet.current &&
          Date.now() <
            lastTimeWhenActiveDataBecameSet.current + WARN_ON_SUBSCRIPTIONS_WITHIN_TIME_MS &&
          !isEqual(
            new Set(subscriptionsForId.map(({ topic }) => topic)),
            new Set((s[id] ?? []).map(({ topic }) => topic)),
          )
        ) {
          // TODO(JP): Might be nice to use `sendNotification` here at some point, so users can let us know about this.
          // However, there is currently a race condition where a layout can get loaded just after the player
          // initializes. I'm not too sure how to prevent that, because we also don't want to ignore whenever the
          // layout changes, since a panel might decide to save its config when data becomes available, and that is
          // bad behaviour by itself too.
          console.warn(
            `Panel subscribed right after Player loaded, which causes unnecessary requests. Please let the Foxglove team know about this. Topics: ${subscriptionsForId
              .map(({ topic }) => topic)
              .join(", ")}`,
          );
        }
        return { ...s, [id]: subscriptionsForId };
      });
    },
    [setAllSubscriptions],
  );
  const setPublishers = useCallback(
    (id: string, publishersForId: AdvertisePayload[]) => {
      setAllPublishers((p) => ({ ...p, [id]: publishersForId }));
    },
    [setAllPublishers],
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
    (async () => {
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
        playerState,
        subscriptions,
        publishers,
        frame,
        sortedTopics,
        datatypes,
        setSubscriptions,
        setPublishers,
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
