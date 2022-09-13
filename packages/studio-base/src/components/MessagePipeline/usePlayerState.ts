// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dispatch, ReducerAction, ReducerState, useReducer } from "react";

import { MessageEvent } from "@foxglove/studio";
import { PlayerPresence, SubscribePayload, PlayerState } from "@foxglove/studio-base/players/types";

type InternalState = {
  subscriptionsById: Map<string, SubscribePayload[]>;
  subscriberIdsByTopic: Map<string, string[]>;
  newTopicsBySubscriberId: Map<string, Set<string>>;
  lastMessageEventByTopic: Map<string, MessageEvent<unknown>>;
  messagesBySubscriberId: Map<string, MessageEvent<unknown>[]>;
  playerState: PlayerState;
  // Function to call when react render has completed with the latest state
  renderDone?: () => void;
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

export type MessagePipelineStateAction = UpdateSubscriberAction | UpdatePlayerStateAction;

// Update state with a subscriber. Any new topics for the subscriber are tracked in newTopicsBySubscriberId
// to receive the last message on their newly subscribed topics.
function updateSubscriberAction(
  prevSubscriberState: InternalState,
  action: UpdateSubscriberAction,
): InternalState {
  const previousSubscriptionsById = prevSubscriberState.subscriptionsById;
  const newTopicsBySubscriberId = new Map(prevSubscriberState.newTopicsBySubscriberId);

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

  const subscriberIdsByTopic: InternalState["subscriberIdsByTopic"] = new Map();

  // make a map of topics to subscriber ids
  for (const [id, subs] of newSubscriptionsById) {
    for (const subscription of subs) {
      const topic = subscription.topic;

      const ids = subscriberIdsByTopic.get(topic) ?? [];
      ids.push(id);
      subscriberIdsByTopic.set(topic, ids);
    }
  }

  return {
    ...prevSubscriberState,
    subscriptionsById: newSubscriptionsById,
    subscriberIdsByTopic,
    newTopicsBySubscriberId,
  };
}

// Update with a player state.
// Put messages from the player state into messagesBySubscriberId. Any new topic subscribers, receive
// the last message on a topic.
function updatePlayerStateAction(
  prevSubscriberState: InternalState,
  action: UpdatePlayerStateAction,
): InternalState {
  const messages = action.playerState.activeData?.messages;

  const seenTopics = new Set<string>();

  // We need a new set of message arrays for each subscriber since downstream users rely
  // on object instance reference checks to determine if there are new messages
  const messagesBySubscriberId = new Map<string, MessageEvent<unknown>[]>();

  const subsById = prevSubscriberState.subscriptionsById;
  const subscriberIdsByTopic = prevSubscriberState.subscriberIdsByTopic;

  const lastMessageEventByTopic = prevSubscriberState.lastMessageEventByTopic;
  const newTopicsBySubscriberId = new Map(prevSubscriberState.newTopicsBySubscriberId);

  // Put messages into per-subscriber queues
  if (messages) {
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
    newTopicsBySubscriberId.delete(id);
  }

  return {
    ...prevSubscriberState,
    newTopicsBySubscriberId,
    messagesBySubscriberId,
    playerState: action.playerState,
    renderDone: action.renderDone,
  };
}

function reduce(
  prevSubscriberState: InternalState,
  action: MessagePipelineStateAction,
): InternalState {
  switch (action.type) {
    case "update-player-state":
      return updatePlayerStateAction(prevSubscriberState, action);
    case "update-subscriber":
      return updateSubscriberAction(prevSubscriberState, action);
  }

  return prevSubscriberState;
}

const initialInternalState: InternalState = {
  subscriptionsById: new Map(),
  subscriberIdsByTopic: new Map(),
  newTopicsBySubscriberId: new Map(),
  lastMessageEventByTopic: new Map(),
  messagesBySubscriberId: new Map(),
  playerState: {
    presence: PlayerPresence.NOT_PRESENT,
    progress: {},
    capabilities: [],
    profile: undefined,
    playerId: "",
    activeData: undefined,
  },
};

/**
 * usePlayerState reduces subscriber and player state updates into subscribers, and messagesBySubscriberId
 * The state updates are managed through a reducer because the state updates to all these fields are dependant
 * on each other.
 */
function usePlayerState(): [ReducerState<typeof reduce>, Dispatch<ReducerAction<typeof reduce>>] {
  return useReducer(reduce, initialInternalState);
}

export { usePlayerState };
