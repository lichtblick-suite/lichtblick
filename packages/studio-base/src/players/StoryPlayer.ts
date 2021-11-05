// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import {
  PlayerState,
  SubscribePayload,
  Player,
  PlayerPresence,
} from "@foxglove/studio-base/players/types";
import BagDataProvider from "@foxglove/studio-base/randomAccessDataProviders/BagDataProvider";
import ParseMessagesDataProvider from "@foxglove/studio-base/randomAccessDataProviders/ParseMessagesDataProvider";

const noop = (): void => {};

const NOOP_PROVIDER = [{ name: "noop", args: {}, children: [] }];

export default class StoryPlayer implements Player {
  private _parsedSubscribedTopics: string[] = [];
  private _bag: string;
  constructor(bag: string) {
    this._bag = bag;
  }
  setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    void (async () => {
      const response = await fetch(this._bag);
      const blobs = await response.blob();
      const provider = new ParseMessagesDataProvider({}, NOOP_PROVIDER, () => {
        return new BagDataProvider(
          {
            bagPath: { type: "file", file: new File([blobs], "test.bag") },
            cacheSizeInBytes: Infinity,
          },
          [],
        );
      });
      void provider
        .initialize({
          progressCallback: () => {
            // no-op
          },
          reportMetadataCallback: () => {
            // no-op
          },
        })
        .then(async ({ topics, start, end, messageDefinitions }) => {
          const { parsedMessages = [] } = await provider.getMessages(start, end, {
            parsedMessages: this._parsedSubscribedTopics,
          });

          if (messageDefinitions.type === "raw") {
            throw new Error("StoryPlayer requires parsed message definitions");
          }

          void listener({
            capabilities: [],
            presence: PlayerPresence.PRESENT,
            playerId: "",
            progress: {},
            activeData: {
              topics,
              datatypes: messageDefinitions.datatypes,
              parsedMessageDefinitionsByTopic: {},
              currentTime: end,
              startTime: start,
              endTime: end,
              messages: parsedMessages,
              messageOrder: "receiveTime",
              lastSeekTime: 0,
              speed: 1,
              isPlaying: false,
              totalBytesReceived: 0,
            },
          });
        });
    })();
  }

  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this._parsedSubscribedTopics = subscriptions.map(({ topic }) => topic);
  }

  close = noop;
  setPublishers = noop;
  setParameter = noop;
  publish = noop;
  startPlayback = noop;
  pausePlayback = noop;
  setPlaybackSpeed = noop;
  seekPlayback = noop;
  requestBackfill = noop;
  setGlobalVariables = noop;
}
