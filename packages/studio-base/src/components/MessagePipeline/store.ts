// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { flatten } from "lodash";
import { MutableRefObject } from "react";
import shallowequal from "shallowequal";
import { createStore, StoreApi } from "zustand";

import { Condvar } from "@foxglove/den/async";
import { MessageEvent } from "@foxglove/studio";
import {
  AdvertiseOptions,
  Player,
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";
import { assertNever } from "@foxglove/studio-base/util/assertNever";

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

  player?: Player;

  /** used to keep track of whether we need to update public.startPlayback/playUntil/etc. */
  lastCapabilities: string[];

  subscriptionsById: Map<string, SubscribePayload[]>;
  publishersById: { [key: string]: AdvertiseOptions[] };
  subscriberIdsByTopic: Map<string, string[]>;
  newTopicsBySubscriberId: Map<string, Set<string>>;
  lastMessageEventByTopic: Map<string, MessageEvent<unknown>>;
  /** Function to call when react render has completed with the latest state */
  renderDone?: () => void;

  /** Part of the state that is exposed to consumers via useMessagePipeline */
  public: MessagePipelineContext;
};

type UpdateSubscriberAction = {
  type: "update-subscriber";
  id: string;
  payloads: SubscribePayload[];
};
type UpdatePlayerStateAction = {
  type: "update-player-state";
  playerState: PlayerState;
  renderDone?: () => void;
};

export type MessagePipelineStateAction =
  | UpdateSubscriberAction
  | UpdatePlayerStateAction
  | { type: "set-player"; player: Player | undefined }
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
    dispatch(action) {
      set((state) => reducer(state, action));
    },
    publishersById: {},
    subscriptionsById: new Map(),
    subscriberIdsByTopic: new Map(),
    newTopicsBySubscriberId: new Map(),
    lastMessageEventByTopic: new Map(),
    lastCapabilities: [],

    public: {
      playerState: defaultPlayerState(),
      messageEventsBySubscriberId: new Map(),
      subscriptions: [],
      publishers: [],
      sortedTopics: [],
      datatypes: new Map(),
      setSubscriptions(id, payloads) {
        get().dispatch({ type: "update-subscriber", id, payloads });
      },
      setPublishers(id, payloads) {
        get().dispatch({ type: "set-publishers", id, payloads });
      },
      setParameter(key, value) {
        get().player?.setParameter(key, value);
      },
      publish(payload) {
        get().player?.publish(payload);
      },
      async callService(service, request) {
        const player = get().player;
        if (player) {
          return await player.callService(service, request);
        }
        throw new Error("callService called when player is not present");
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
// Update state with a subscriber. Any new topics for the subscriber are tracked in newTopicsBySubscriberId
// to receive the last message on their newly subscribed topics.
function updateSubscriberAction(
  prevState: MessagePipelineInternalState,
  action: UpdateSubscriberAction,
): MessagePipelineInternalState {
  const previousSubscriptionsById = prevState.subscriptionsById;
  const newTopicsBySubscriberId = new Map(prevState.newTopicsBySubscriberId);

  // Record any _new_ topics for this subscriber into newTopicsBySubscriberId
  const newTopics = newTopicsBySubscriberId.get(action.id);
  if (!newTopics) {
    const actionTopics = action.payloads.map((sub) => sub.topic);
    newTopicsBySubscriberId.set(action.id, new Set(actionTopics));
  } else {
    const previousSubscription = previousSubscriptionsById.get(action.id);
    const prevTopics = new Set(previousSubscription?.map((sub) => sub.topic) ?? []);
    for (const { topic: newTopic } of action.payloads) {
      if (!prevTopics.has(newTopic)) {
        newTopics.add(newTopic);
      }
    }
  }

  const newSubscriptionsById = new Map(previousSubscriptionsById);

  if (action.payloads.length === 0) {
    // When a subscription id has no topics we removed it from our map
    newSubscriptionsById.delete(action.id);
  } else {
    newSubscriptionsById.set(action.id, action.payloads);
  }

  const subscriberIdsByTopic = new Map<string, string[]>();

  const subscriptions: SubscribePayload[] = [];

  // make a map of topics to subscriber ids
  for (const [id, subs] of newSubscriptionsById) {
    for (const subscription of subs) {
      const topic = subscription.topic;

      const ids = subscriberIdsByTopic.get(topic) ?? [];
      ids.push(id);
      subscriberIdsByTopic.set(topic, ids);
      subscriptions.push(subscription);
    }
  }

  return {
    ...prevState,
    subscriptionsById: newSubscriptionsById,
    subscriberIdsByTopic,
    newTopicsBySubscriberId,
    public: {
      ...prevState.public,
      subscriptions,
    },
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
  const messagesBySubscriberId = new Map<string, MessageEvent<unknown>[]>();

  const subsById = prevState.subscriptionsById;
  const subscriberIdsByTopic = prevState.subscriberIdsByTopic;

  const lastMessageEventByTopic = prevState.lastMessageEventByTopic;
  const newTopicsBySubscriberId = new Map(prevState.newTopicsBySubscriberId);

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
        let subscriberMessageEvents = messagesBySubscriberId.get(id);
        if (!subscriberMessageEvents) {
          subscriberMessageEvents = [];
          messagesBySubscriberId.set(id, subscriberMessageEvents);
        }
        subscriberMessageEvents.push(messageEvent);
      }
    }
  }

  // Inject the last message on a topic to all new subscribers of the topic
  for (const id of subsById.keys()) {
    const newTopics = newTopicsBySubscriberId.get(id);
    if (!newTopics) {
      continue;
    }
    for (const topic of newTopics) {
      // If we had a message for this topic in the regular set of messages, we don't need to inject
      // another message.
      if (seenTopics.has(topic)) {
        continue;
      }
      const msgEvent = lastMessageEventByTopic.get(topic);
      if (msgEvent) {
        const subscriberMessageEvents = messagesBySubscriberId.get(id) ?? [];
        // the injected message is older than any new messages
        subscriberMessageEvents.unshift(msgEvent);
        messagesBySubscriberId.set(id, subscriberMessageEvents);
      }
    }
    // We've processed all new subscriber topics into message queues
    newTopics.clear();
  }

  const newPublicState = {
    ...prevState.public,
    playerState: action.playerState,
    messageEventsBySubscriberId: messagesBySubscriberId,
  };

  const topics = action.playerState.activeData?.topics;
  if (!shallowequal(topics, prevState.public.playerState.activeData?.topics)) {
    newPublicState.sortedTopics = topics
      ? [...topics].sort((a, b) => a.name.localeCompare(b.name))
      : [];
  }
  if (
    !shallowequal(
      action.playerState.activeData?.datatypes,
      prevState.public.playerState.activeData?.datatypes,
    )
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
    newTopicsBySubscriberId,
    renderDone: action.renderDone,
    public: newPublicState,
    lastCapabilities: capabilities,
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
        public: { ...prevState.public, publishers: flatten(Object.values(newPublishersById)) },
      };
    }

    case "set-player":
      if (action.player === prevState.player) {
        return prevState;
      }
      return {
        ...prevState,
        player: action.player,
        lastCapabilities: [],
        public: {
          ...prevState.public,
          sortedTopics: [],
          datatypes: new Map(),
          startPlayback: undefined,
          pausePlayback: undefined,
          playUntil: undefined,
          setPlaybackSpeed: undefined,
          seekPlayback: undefined,
        },
      };
  }

  assertNever(
    action,
    `Unhandled message pipeline action type ${(action as MessagePipelineStateAction).type}`,
  );
}
