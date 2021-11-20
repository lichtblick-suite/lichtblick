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
import { Time, isLessThan, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { PlayerState, MessageEvent } from "@foxglove/studio-base/players/types";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import { formatFrame, getTimestampForMessageEvent } from "@foxglove/studio-base/util/time";

const DRIFT_THRESHOLD_SEC = 1; // Maximum amount of drift allowed.
const WAIT_FOR_SEEK_SEC = 1; // How long we wait for a change in `lastSeekTime` before warning.

const log = Logger.getLogger(__filename);

// Logs a warning when there is a significant difference (more than `DRIFT_THRESHOLD_SEC`) between
// a message's timestamp and `player.currentTime` OR when messages went back in time,
// except when `player.lastSeekTime` changes, in which case panels should be clearing out their stored data.
//
// This is to ensure that other mechanisms that we have in place for either discarding old messages
// or forcing an update of `player.lastSeekTime` are working properly.
class MessageOrderTracker {
  private lastMessages: readonly MessageEvent<unknown>[] = [];
  private lastCurrentTime?: Time;
  private lastMessageTime?: Time;
  private lastMessageTopic?: string;
  private lastLastSeekTime?: number;
  private warningTimeout?: ReturnType<typeof setTimeout>;
  private incorrectMessages: MessageEvent<unknown>[] = [];

  update(playerState: PlayerState): void {
    if (!playerState.activeData) {
      return;
    }
    const { messages, messageOrder, currentTime, lastSeekTime } = playerState.activeData;
    if (this.lastLastSeekTime !== lastSeekTime) {
      this.lastLastSeekTime = lastSeekTime;
      if (this.warningTimeout) {
        clearTimeout(this.warningTimeout);
        this.warningTimeout = undefined;
        this.incorrectMessages = [];
      }
      this.warningTimeout = this.lastMessageTime = this.lastCurrentTime = undefined;
      this.lastMessages = [];
    }
    if (this.lastMessages !== messages || this.lastCurrentTime !== currentTime) {
      this.lastMessages = messages;
      this.lastCurrentTime = currentTime;
      for (const message of messages) {
        const messageTime = getTimestampForMessageEvent(message, messageOrder);
        if (!messageTime) {
          sendNotification(
            `Message has no ${messageOrder}`,
            `Received a message on topic ${message.topic} around ${formatFrame(
              currentTime,
            )} with ` + `no ${messageOrder} when sorting by that method.`,
            "app",
            "warn",
          );
          this.lastMessageTopic = message.topic;
          this.lastMessageTime = undefined;
          continue;
        }
        const currentTimeDrift = Math.abs(toSec(subtractTimes(messageTime, currentTime)));

        if (currentTimeDrift > DRIFT_THRESHOLD_SEC) {
          this.incorrectMessages.push(message);
          if (!this.warningTimeout) {
            this.warningTimeout = setTimeout(() => {
              // timeout has fired, we need to clear so a new timeout registers if there are more messages
              this.warningTimeout = undefined;
              // reset incorrect message queue before posting warning so we never keep incorrectMessages around
              const tempMessages = this.incorrectMessages;
              this.incorrectMessages = [];
              log.warn(
                `${messageOrder} very different from player.currentTime; without updating lastSeekTime`,
                {
                  currentTime,
                  lastSeekTime,
                  messageOrder,
                  messageTime,
                  tempMessages,
                },
              );
            }, WAIT_FOR_SEEK_SEC * 1000);
          }
        }

        if (
          this.lastMessageTime &&
          this.lastMessageTopic != undefined &&
          isLessThan(messageTime, this.lastMessageTime)
        ) {
          sendNotification(
            "Bag went back in time",
            `Processed a message on ${message.topic} at ${formatFrame(
              messageTime,
            )} which is earlier than ` +
              `last processed message on ${this.lastMessageTopic} at ${formatFrame(
                this.lastMessageTime,
              )}. ` +
              `Data source may be corrupted on these or other topics.`,
            "user",
            "warn",
          );
        }
        this.lastMessageTopic = message.topic;
        this.lastMessageTime = messageTime;
      }
    }
  }
}

export default MessageOrderTracker;
