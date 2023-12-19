// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { MutableRefObject } from "react";
import shallowequal from "shallowequal";
import { createStore, StoreApi } from "zustand";

import { Condvar } from "@foxglove/den/async";
import { Immutable, MessageEvent } from "@foxglove/studio";
import {
  makeSubscriptionMemoizer,
  mergeSubscriptions,
} from "@foxglove/studio-base/components/MessagePipeline/subscriptions";
import {
  AdvertiseOptions,
  Player,
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";
import { assertNever } from "@foxglove/studio-base/util/assertNever";
import isDesktopApp from "@foxglove/studio-base/util/isDesktopApp";

import { FramePromise } from "./pauseFrameForPromise";
import { MessagePipelineContext } from "./types";

export function defaultPlayerState(): PlayerState {
  return {
    presence: PlayerPresence.NOT_PRESENT,
    progress: {},
    capabilities: [],
    profile: undefined,
    playerId: "",
    activeData: undefined,
  };
}

export type MessagePipelineInternalState = {
  dispatch: (action: MessagePipelineStateAction) => void;

  /** Reset public and private state back to initial empty values */
  reset: () => void;

  player?: Player;

  /** used to keep track of whether we need to update public.startPlayback/playUntil/etc. */
  lastCapabilities: string[];
  /** Preserves reference equality of subscriptions to minimize player subscription churn. */
  subscriptionMemoizer: (sub: SubscribePayload) => SubscribePayload;
  subscriptionsById: Map<string, Immutable<SubscribePayload[]>>;
  publishersById: { [key: string]: AdvertiseOptions[] };
  allPublishers: AdvertiseOptions[];
  /**
   * A map of topic name to the IDs that are subscribed to that topic. Incoming messages
   * are bucketed by ID so only the messages a panel subscribed to are sent to it.
   *
   * Note: Even though we avoid storing the same ID twice in the array, we use an array rather than
   * a Set because iterating over array elements is faster than iterating a Set and the "hot" path
   * for dispatching messages needs to iterate over the array of IDs.
   */
  subscriberIdsByTopic: Map<string, string[]>;
  /** This holds the last message emitted by the player on each topic. Attempt to use this before falling back to player backfill.
   */
  lastMessageEventByTopic: Map<string, MessageEvent>;
  /** Function to call when react render has completed with the latest state */
  renderDone?: () => void;

  /** Part of the state that is exposed to consumers via useMessagePipeline */
  public: MessagePipelineContext;
};

type UpdateSubscriberAction = {
  type: "update-subscriber";
  id: string;
  payloads: Immutable<SubscribePayload[]>;
};
type UpdatePlayerStateAction = {
  type: "update-player-state";
  playerState: PlayerState;
  renderDone?: () => void;
};

export type MessagePipelineStateAction =
  | UpdateSubscriberAction
  | UpdatePlayerStateAction
  | { type: "set-publishers"; id: string; payloads: AdvertiseOptions[] };

export function createMessagePipelineStore({
  promisesToWaitForRef,
  initialPlayer,
}: {
  promisesToWaitForRef: MutableRefObject<FramePromise[]>;
  initialPlayer: Player | undefined;
}): StoreApi<MessagePipelineInternalState> {
  return createStore((set, get) => ({
    player: initialPlayer,
    publishersById: {},
    allPublishers: [],
    subscriptionMemoizer: makeSubscriptionMemoizer(),
    subscriptionsById: new Map(),
    subscriberIdsByTopic: new Map(),
    newTopicsBySubscriberId: new Map(),
    lastMessageEventByTopic: new Map(),
    lastCapabilities: [],

    dispatch(action) {
      set((state) => reducer(state, action));
    },

    reset() {
      set((prev) => ({
        ...prev,
        publishersById: {},
        allPublishers: [],
        subscriptionMemoizer: makeSubscriptionMemoizer(),
        subscriptionsById: new Map(),
        subscriberIdsByTopic: new Map(),
        newTopicsBySubscriberId: new Map(),
        lastMessageEventByTopic: new Map(),
        lastCapabilities: [],
        public: {
          ...prev.public,
          playerState: defaultPlayerState(),
          messageEventsBySubscriberId: new Map(),
          subscriptions: [],
          sortedTopics: [],
          datatypes: new Map(),
          startPlayback: undefined,
          playUntil: undefined,
          pausePlayback: undefined,
          setPlaybackSpeed: undefined,
          seekPlayback: undefined,
        },
      }));
    },

    public: {
      playerState: defaultPlayerState(),
      messageEventsBySubscriberId: new Map(),
      subscriptions: [],
      sortedTopics: [],
      datatypes: new Map(),
      setSubscriptions(id, payloads) {
        get().dispatch({ type: "update-subscriber", id, payloads });
      },
      setPublishers(id, payloads) {
        get().dispatch({ type: "set-publishers", id, payloads });
        get().player?.setPublishers(get().allPublishers);
      },
      setParameter(key, value) {
        get().player?.setParameter(key, value);
      },
      publish(payload) {
        get().player?.publish(payload);
      },
      async callService(service, request) {
        const player = get().player;
        if (!player) {
          throw new Error("callService called when player is not present");
        }
        return await player.callService(service, request);
      },
      async fetchAsset(uri, options) {
        const { protocol } = new URL(uri);
        const player = get().player;

        if (protocol === "package:") {
          // For the desktop app, package:// is registered as a supported schema for builtin _fetch_ calls.
          const canBuiltinFetchPkgUri = isDesktopApp();
          const pkgPath = uri.slice("package://".length);
          const pkgName = pkgPath.split("/")[0];

          if (player?.fetchAsset) {
            try {
              return await player.fetchAsset(uri);
            } catch (err) {
              if (canBuiltinFetchPkgUri) {
                // Fallback to a builtin _fetch_ call if the asset couldn't be loaded through the player.
                return await builtinFetch(uri, options);
              }
              throw err; // Bail out otherwise.
            }
          } else if (canBuiltinFetchPkgUri) {
            return await builtinFetch(uri, options);
          } else if (
            pkgName &&
            options?.referenceUrl != undefined &&
            !options.referenceUrl.startsWith("package://") &&
            options.referenceUrl.includes(pkgName)
          ) {
            // As last resort to load the package://<pkgName>/<pkgPath> URL, we resolve the package URL to
            // be relative of the base URL (which contains <pkgName> and is not a package:// URL itself).
            // Example:
            //   base URL: https://example.com/<pkgName>/urdf/robot.urdf
            //   resolved: https://example.com/<pkgName>/<pkgPath>
            const resolvedUrl =
              options.referenceUrl.slice(0, options.referenceUrl.lastIndexOf(pkgName)) + pkgPath;
            return await builtinFetch(resolvedUrl, options);
          }
        }

        // Use a regular fetch for all other protocols
        return await builtinFetch(uri, options);
      },
      startPlayback: undefined,
      playUntil: undefined,
      pausePlayback: undefined,
      setPlaybackSpeed: undefined,
      seekPlayback: undefined,

      pauseFrame(name: string) {
        const condvar = new Condvar();
        promisesToWaitForRef.current.push({ name, promise: condvar.wait() });
        return () => {
          condvar.notifyAll();
        };
      },
    },
  }));
}
/** Update subscriptions. New topics that have already emit messages previously we emit the last message on the topic to the subscriber */
function updateSubscriberAction(
  prevState: MessagePipelineInternalState,
  action: UpdateSubscriberAction,
): MessagePipelineInternalState {
  const previousSubscriptionsById = prevState.subscriptionsById;

  const subscriptionsById = new Map(previousSubscriptionsById);

  if (action.payloads.length === 0) {
    // When a subscription id has no topics we removed it from our map
    subscriptionsById.delete(action.id);
  } else {
    subscriptionsById.set(action.id, action.payloads);
  }

  const subscriberIdsByTopic = new Map<string, string[]>();

  // make a map of topics to subscriber ids
  for (const [id, subs] of subscriptionsById) {
    for (const subscription of subs) {
      const topic = subscription.topic;

      const ids = subscriberIdsByTopic.get(topic) ?? [];
      // If the id is already present in the array for the topic then we should not add it again.
      // If we add it again it will be given frame messages again when bucketing incoming messages
      // by subscriber id.
      if (!ids.includes(id)) {
        ids.push(id);
      }
      subscriberIdsByTopic.set(topic, ids);
    }
  }

  // Record any _new_ topics for this subscriber so that we can emit last messages on these topics
  const newTopicsForId = new Set<string>();

  const prevSubsForId = previousSubscriptionsById.get(action.id);
  const prevTopics = new Set(prevSubsForId?.map((sub) => sub.topic) ?? []);
  for (const { topic: newTopic } of action.payloads) {
    if (!prevTopics.has(newTopic)) {
      newTopicsForId.add(newTopic);
    }
  }

  const lastMessageEventByTopic = new Map(prevState.lastMessageEventByTopic);

  for (const topic of prevTopics) {
    // if this topic has no other subscribers, we want to remove it from the lastMessageEventByTopic.
    // This fixes the case where if a panel unsubscribes, triggers playback, and then resubscribes,
    // they won't get this old stale message when they resubscribe again before getting the message
    // at the current time frome seek-backfill.
    if (!subscriberIdsByTopic.has(topic)) {
      lastMessageEventByTopic.delete(topic);
    }
  }

  // Inject the last message on new topics for this subscriber
  const messagesForSubscriber = [];
  for (const topic of newTopicsForId) {
    const msgEvent = lastMessageEventByTopic.get(topic);
    if (msgEvent) {
      messagesForSubscriber.push(msgEvent);
    }
  }

  let newMessagesBySubscriberId;

  if (messagesForSubscriber.length > 0) {
    newMessagesBySubscriberId = new Map<string, readonly MessageEvent[]>(
      prevState.public.messageEventsBySubscriberId,
    );
    // This should update only the panel that subscribed to the new topic
    newMessagesBySubscriberId.set(action.id, messagesForSubscriber);
  }

  const subscriptions = mergeSubscriptions(Array.from(subscriptionsById.values()).flat());

  const newPublicState = {
    ...prevState.public,
    subscriptions,
    messageEventsBySubscriberId:
      newMessagesBySubscriberId ?? prevState.public.messageEventsBySubscriberId,
  };

  return {
    ...prevState,
    lastMessageEventByTopic,
    subscriptionsById,
    subscriberIdsByTopic,
    public: newPublicState,
  };
}
// Update with a player state.
// Put messages from the player state into messagesBySubscriberId. Any new topic subscribers, receive
// the last message on a topic.
function updatePlayerStateAction(
  prevState: MessagePipelineInternalState,
  action: UpdatePlayerStateAction,
): MessagePipelineInternalState {
  const messages = action.playerState.activeData?.messages;

  const seenTopics = new Set<string>();

  // We need a new set of message arrays for each subscriber since downstream users rely
  // on object instance reference checks to determine if there are new messages
  const messagesBySubscriberId = new Map<string, MessageEvent[]>();

  const subscriberIdsByTopic = prevState.subscriberIdsByTopic;

  const lastMessageEventByTopic = prevState.lastMessageEventByTopic;

  // Put messages into per-subscriber queues
  if (messages && messages !== prevState.public.playerState.activeData?.messages) {
    for (const messageEvent of messages) {
      // Save the last message on every topic to send the last message
      // to newly subscribed panels.
      lastMessageEventByTopic.set(messageEvent.topic, messageEvent);

      seenTopics.add(messageEvent.topic);
      const ids = subscriberIdsByTopic.get(messageEvent.topic);
      if (!ids) {
        continue;
      }

      for (const id of ids) {
        const subscriberMessageEvents = messagesBySubscriberId.get(id);
        if (!subscriberMessageEvents) {
          messagesBySubscriberId.set(id, [messageEvent]);
        } else {
          subscriberMessageEvents.push(messageEvent);
        }
      }
    }
  }

  const newPublicState = {
    ...prevState.public,
    playerState: action.playerState,
    messageEventsBySubscriberId: messagesBySubscriberId,
  };
  const topics = action.playerState.activeData?.topics;
  if (topics !== prevState.public.playerState.activeData?.topics) {
    newPublicState.sortedTopics = topics
      ? [...topics].sort((a, b) => a.name.localeCompare(b.name))
      : [];
  }
  if (
    action.playerState.activeData?.datatypes !== prevState.public.playerState.activeData?.datatypes
  ) {
    newPublicState.datatypes = action.playerState.activeData?.datatypes ?? new Map();
  }

  const capabilities = action.playerState.capabilities;
  const player = prevState.player;
  if (player && !shallowequal(capabilities, prevState.lastCapabilities)) {
    newPublicState.startPlayback = capabilities.includes(PlayerCapabilities.playbackControl)
      ? player.startPlayback?.bind(player)
      : undefined;
    newPublicState.playUntil = capabilities.includes(PlayerCapabilities.playbackControl)
      ? player.playUntil?.bind(player)
      : undefined;
    newPublicState.pausePlayback = capabilities.includes(PlayerCapabilities.playbackControl)
      ? player.pausePlayback?.bind(player)
      : undefined;
    newPublicState.setPlaybackSpeed = capabilities.includes(PlayerCapabilities.setSpeed)
      ? player.setPlaybackSpeed?.bind(player)
      : undefined;
    newPublicState.seekPlayback = capabilities.includes(PlayerCapabilities.playbackControl)
      ? player.seekPlayback?.bind(player)
      : undefined;
  }

  return {
    ...prevState,
    renderDone: action.renderDone,
    public: newPublicState,
    lastCapabilities: capabilities,
    lastMessageEventByTopic,
  };
}

export function reducer(
  prevState: MessagePipelineInternalState,
  action: MessagePipelineStateAction,
): MessagePipelineInternalState {
  switch (action.type) {
    case "update-player-state":
      return updatePlayerStateAction(prevState, action);
    case "update-subscriber":
      return updateSubscriberAction(prevState, action);

    case "set-publishers": {
      const newPublishersById = { ...prevState.publishersById, [action.id]: action.payloads };

      return {
        ...prevState,
        publishersById: newPublishersById,
        allPublishers: _.flatten(Object.values(newPublishersById)),
      };
    }
  }

  assertNever(
    action,
    `Unhandled message pipeline action type ${(action as MessagePipelineStateAction).type}`,
  );
}

async function builtinFetch(url: string, opts?: { signal?: AbortSignal }) {
  const response = await fetch(url, opts);
  if (!response.ok) {
    const errMsg = response.statusText;
    throw new Error(`Error ${response.status}${errMsg ? ` (${errMsg})` : ``}`);
  }
  return {
    uri: url,
    data: new Uint8Array(await response.arrayBuffer()),
    mediaType: response.headers.get("content-type") ?? undefined,
  };
}
