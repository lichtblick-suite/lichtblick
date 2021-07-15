// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { mapValues } from "lodash";

import { Time, areEqual, compare, isLessThan } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

type MessagesByTopic = { [topic: string]: readonly MessageEvent<unknown>[] };
type MessageByTopic = { [topic: string]: MessageEvent<unknown> };

export const defaultGetHeaderStamp = (message?: unknown): Time | undefined => {
  return message != undefined ? getTimestampForMessage(message) : undefined;
};

function allMessageStampsNewestFirst(
  messagesByTopic: Readonly<MessagesByTopic>,
  getHeaderStamp?: (itemMessage: MessageEvent<unknown>) => Time | undefined,
) {
  const stamps = [];
  for (const messages of Object.values(messagesByTopic)) {
    for (const message of messages) {
      const stamp = getHeaderStamp
        ? getHeaderStamp(message)
        : defaultGetHeaderStamp(message.message);
      if (stamp) {
        stamps.push(stamp);
      }
    }
  }
  return stamps.sort((a, b) => -compare(a, b));
}

// Get a subset of items matching a particular timestamp
function messagesMatchingStamp(
  stamp: Time,
  messagesByTopic: Readonly<MessagesByTopic>,
  getHeaderStamp?: (itemMessage: MessageEvent<unknown>) => Time | undefined,
): Readonly<MessagesByTopic> | undefined {
  const synchronizedMessagesByTopic: MessagesByTopic = {};
  for (const [topic, messages] of Object.entries(messagesByTopic)) {
    const synchronizedMessage = messages.find((message) => {
      const thisStamp = getHeaderStamp
        ? getHeaderStamp(message)
        : defaultGetHeaderStamp(message.message);
      return thisStamp && areEqual(stamp, thisStamp);
    });
    if (synchronizedMessage != undefined) {
      synchronizedMessagesByTopic[topic] = [synchronizedMessage];
    } else {
      return undefined;
    }
  }
  return synchronizedMessagesByTopic;
}

// Return a synchronized subset of the messages in `messagesByTopic` with exactly matching
// header.stamps.
// If multiple sets of synchronized messages are included, the one with the later header.stamp is
// returned.
export default function synchronizeMessages(
  messagesByTopic: Readonly<MessagesByTopic>,
  getHeaderStamp?: (itemMessage: MessageEvent<unknown>) => Time | undefined,
): Readonly<MessagesByTopic> | undefined {
  for (const stamp of allMessageStampsNewestFirst(messagesByTopic, getHeaderStamp)) {
    const synchronizedMessagesByTopic = messagesMatchingStamp(
      stamp,
      messagesByTopic,
      getHeaderStamp,
    );
    if (synchronizedMessagesByTopic != undefined) {
      return synchronizedMessagesByTopic;
    }
  }
  return undefined;
}

function getSynchronizedMessages(
  stamp: Time,
  topics: readonly string[],
  messages: MessagesByTopic,
): MessageByTopic | undefined {
  const synchronizedMessages: MessageByTopic = {};
  for (const topic of topics) {
    const matchingMessage = messages[topic]?.find(({ message }) => {
      const thisStamp = getTimestampForMessage(message);
      return thisStamp && areEqual(stamp, thisStamp);
    });
    if (!matchingMessage) {
      return undefined;
    }
    synchronizedMessages[topic] = matchingMessage;
  }
  return synchronizedMessages;
}

type ReducedValue = {
  messagesByTopic: MessagesByTopic;
  synchronizedMessages?: MessageByTopic;
};

function getSynchronizedState(
  topics: readonly string[],
  { messagesByTopic, synchronizedMessages }: ReducedValue,
): ReducedValue {
  let newMessagesByTopic = messagesByTopic;
  let newSynchronizedMessages = synchronizedMessages;

  for (const stamp of allMessageStampsNewestFirst(messagesByTopic)) {
    const syncedMsgs = getSynchronizedMessages(stamp, topics, messagesByTopic);
    if (syncedMsgs) {
      // We've found a new synchronized set; remove messages older than these.
      newSynchronizedMessages = syncedMsgs;
      newMessagesByTopic = mapValues(newMessagesByTopic, (msgsByTopic) =>
        msgsByTopic.filter(({ message }) => {
          const thisStamp = getTimestampForMessage(message);
          return thisStamp != undefined && !isLessThan(thisStamp, stamp);
        }),
      );
      break;
    }
  }
  return { messagesByTopic: newMessagesByTopic, synchronizedMessages: newSynchronizedMessages };
}

// Returns reducers for use with PanelAPI.useMessageReducer
export function getSynchronizingReducers(topics: readonly string[]): {
  restore: (value?: ReducedValue) => ReducedValue;
  addMessage: (value: ReducedValue, newMessage: MessageEvent<unknown>) => ReducedValue;
} {
  return {
    restore: (previousValue?: ReducedValue) => {
      const messagesByTopic: MessagesByTopic = {};
      for (const topic of topics) {
        messagesByTopic[topic] = previousValue?.messagesByTopic[topic] ?? [];
      }
      return getSynchronizedState(topics, { messagesByTopic });
    },
    addMessage: (
      { messagesByTopic, synchronizedMessages }: ReducedValue,
      newMessage: MessageEvent<unknown>,
    ) => {
      const messages = messagesByTopic[newMessage.topic];
      return getSynchronizedState(topics, {
        messagesByTopic: {
          ...messagesByTopic,
          [newMessage.topic]: messages ? messages.concat(newMessage) : [newMessage],
        },
        synchronizedMessages,
      });
    },
  };
}
