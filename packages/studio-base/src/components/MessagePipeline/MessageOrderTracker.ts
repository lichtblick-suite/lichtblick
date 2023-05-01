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
import { PlayerState, MessageEvent, PlayerProblem } from "@foxglove/studio-base/players/types";
import { formatFrame } from "@foxglove/studio-base/util/time";

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
  #lastMessages: readonly MessageEvent<unknown>[] = [];
  #lastCurrentTime?: Time;
  #lastMessageTime?: Time;
  #lastMessageTopic?: string;
  #lastLastSeekTime?: number;
  #warningTimeout?: ReturnType<typeof setTimeout>;

  /**
   * Set this to `true` to debug out-of-order messages. It is disabled by default in production
   * because logging messages to the console prevents them from getting garbage-collected as long as
   * the console is not cleared.
   */
  #trackIncorrectMessages = false;

  #incorrectMessages: MessageEvent<unknown>[] = [];

  public update(playerState: PlayerState): PlayerProblem[] {
    if (!playerState.activeData) {
      return [];
    }

    const problems: PlayerProblem[] = [];

    const { messages, currentTime, lastSeekTime } = playerState.activeData;
    let didSeek = false;

    if (this.#lastLastSeekTime !== lastSeekTime) {
      this.#lastLastSeekTime = lastSeekTime;
      if (this.#warningTimeout) {
        clearTimeout(this.#warningTimeout);
        this.#warningTimeout = undefined;
        this.#incorrectMessages = [];
      }
      this.#warningTimeout = this.#lastMessageTime = this.#lastCurrentTime = undefined;
      this.#lastMessages = [];
      didSeek = true;
    }
    if (this.#lastMessages !== messages || this.#lastCurrentTime !== currentTime) {
      this.#lastMessages = messages;
      this.#lastCurrentTime = currentTime;
      for (const message of messages) {
        const messageTime = message.receiveTime;

        // The first emit after a seek occurs from a backfill. This backfill might produce messages
        // much older than the seek time.
        if (!didSeek) {
          const currentTimeDrift = Math.abs(toSec(subtractTimes(messageTime, currentTime)));
          if (currentTimeDrift > DRIFT_THRESHOLD_SEC) {
            if (this.#trackIncorrectMessages) {
              this.#incorrectMessages.push(message);
            }
            if (!this.#warningTimeout) {
              this.#warningTimeout = setTimeout(() => {
                // timeout has fired, we need to clear so a new timeout registers if there are more messages
                this.#warningTimeout = undefined;
                // reset incorrect message queue before posting warning so we never keep
                // incorrectMessages around. The browser console will keep messages in memory when
                // logged, so disable logging of messages unless explicitly enabled.
                const info = {
                  currentTime,
                  lastSeekTime,
                  messageTime,
                  incorrectMessages: this.#trackIncorrectMessages
                    ? this.#incorrectMessages
                    : "not being tracked",
                };
                this.#incorrectMessages = [];
                log.warn(
                  `Message receiveTime very different from player.currentTime; without updating lastSeekTime`,
                  info,
                );
              }, WAIT_FOR_SEEK_SEC * 1000);
            }
          }
        }

        if (
          this.#lastMessageTime &&
          this.#lastMessageTopic != undefined &&
          isLessThan(messageTime, this.#lastMessageTime)
        ) {
          const formattedTime = formatFrame(messageTime);
          const lastMessageTime = formatFrame(this.#lastMessageTime);
          const errorMessage =
            `Processed a message on ${message.topic} at ${formattedTime} which is earlier than ` +
            `last processed message on ${this.#lastMessageTopic} at ${lastMessageTime}.`;

          problems.push({
            severity: "warn",
            message: "Data went back in time",
            error: new Error(errorMessage),
          });
        }
        this.#lastMessageTopic = message.topic;
        this.#lastMessageTime = messageTime;
      }
    }

    return problems;
  }
}

export default MessageOrderTracker;
