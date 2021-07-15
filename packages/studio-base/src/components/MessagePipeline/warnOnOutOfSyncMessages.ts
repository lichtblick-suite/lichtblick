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

import Logger from "@foxglove/log";
import { Time, isLessThan } from "@foxglove/rostime";
import { PlayerState, MessageEvent } from "@foxglove/studio-base/players/types";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import {
  subtractTimes,
  toSec,
  formatFrame,
  getTimestampForMessageEvent,
} from "@foxglove/studio-base/util/time";

const DRIFT_THRESHOLD_SEC = 1; // Maximum amount of drift allowed.
const WAIT_FOR_SEEK_SEC = 1; // How long we wait for a change in `lastSeekTime` before warning.

const log = Logger.getLogger(__filename);

// Logs a warning when there is a significant difference (more than `DRIFT_THRESHOLD_SEC`) between
// a message's timestamp and `player.currentTime` OR when messages went back in time,
// except when `player.lastSeekTime` changes, in which case panels should be clearing out their stored data.
//
// This is to ensure that other mechanisms that we have in place for either discarding old messages
// or forcing an update of `player.lastSeekTime` are working properly.
let lastMessages: readonly MessageEvent<unknown>[] | undefined;
let lastCurrentTime: Time | undefined;
let lastMessageTime: Time | undefined;
let lastMessageTopic: string | undefined;
let lastLastSeekTime: number | undefined;
let warningTimeout: ReturnType<typeof setTimeout> | undefined;
let incorrectMessages: MessageEvent<unknown>[] = [];

export default function warnOnOutOfSyncMessages(playerState: PlayerState): void {
  if (!playerState.activeData) {
    return;
  }
  const { messages, messageOrder, currentTime, lastSeekTime } = playerState.activeData;
  if (lastLastSeekTime !== lastSeekTime) {
    lastLastSeekTime = lastSeekTime;
    if (warningTimeout) {
      clearTimeout(warningTimeout);
      incorrectMessages = [];
    }
    warningTimeout = lastMessages = lastMessageTime = lastCurrentTime = undefined;
  }
  if (lastMessages !== messages || lastCurrentTime !== currentTime) {
    lastMessages = messages;
    lastCurrentTime = currentTime;
    for (const message of messages) {
      const messageTime = getTimestampForMessageEvent(message, messageOrder);
      if (!messageTime) {
        sendNotification(
          `Message has no ${messageOrder}`,
          `Received a message on topic ${message.topic} around ${formatFrame(currentTime)} with ` +
            `no ${messageOrder} when sorting by that method.`,
          "app",
          "warn",
        );
        lastMessageTopic = message.topic;
        lastMessageTime = undefined;
        continue;
      }
      const currentTimeDrift = Math.abs(toSec(subtractTimes(messageTime, currentTime)));

      if (currentTimeDrift > DRIFT_THRESHOLD_SEC) {
        incorrectMessages.push(message);
        if (!warningTimeout) {
          warningTimeout = setTimeout(() => {
            log.warn(
              `${messageOrder} very different from player.currentTime; without updating lastSeekTime`,
              {
                currentTime,
                lastSeekTime,
                messageOrder,
                messageTime,
                incorrectMessages,
              },
            );
          }, WAIT_FOR_SEEK_SEC * 1000);
        }
      }

      if (
        lastMessageTime &&
        lastMessageTopic != undefined &&
        isLessThan(messageTime, lastMessageTime)
      ) {
        sendNotification(
          "Bag went back in time",
          `Processed a message on ${message.topic} at ${formatFrame(
            messageTime,
          )} which is earlier than ` +
            `last processed message on ${lastMessageTopic} at ${formatFrame(lastMessageTime)}. ` +
            `Data source may be corrupted on these or other topics.`,
          "user",
          "warn",
        );
      }
      lastMessageTopic = message.topic;
      lastMessageTime = messageTime;
    }
  }
}
