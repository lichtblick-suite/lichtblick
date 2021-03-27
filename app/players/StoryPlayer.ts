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

import { partition } from "lodash";

import BagDataProvider from "@foxglove-studio/app/dataProviders/BagDataProvider";
import CombinedDataProvider from "@foxglove-studio/app/dataProviders/CombinedDataProvider";
import ParseMessagesDataProvider from "@foxglove-studio/app/dataProviders/ParseMessagesDataProvider";
import RenameDataProvider from "@foxglove-studio/app/dataProviders/RenameDataProvider";
import RewriteBinaryDataProvider from "@foxglove-studio/app/dataProviders/RewriteBinaryDataProvider";
import {
  PlayerState,
  SubscribePayload,
  Player,
  PlayerPresence,
} from "@foxglove-studio/app/players/types";

import { SECOND_SOURCE_PREFIX } from "../util/globalConstants";

const noop = () => {
  // no-op
};

const getBagDescriptor = async (url?: string) => {
  if (!url) {
    throw new Error("No bag url provided.");
  }
  const response = await fetch(url);
  if (!response) {
    throw new Error(`Failed to fetch the bag: ${url || "undefined"}`);
  }

  const blobs = await response.blob();
  return { type: "file", file: new File([blobs], "test.bag") };
};

const NOOP_PROVIDER = [{ name: "noop", args: {}, children: [] }];

export default class StoryPlayer implements Player {
  _parsedSubscribedTopics: string[] = [];
  _bobjectSubscribedTopics: string[] = [];
  _bags: string[] = [];
  constructor(bags: string[]) {
    this._bags = bags;
  }
  setListener(listener: (arg0: PlayerState) => Promise<void>) {
    (async () => {
      const bagDescriptors = await Promise.all(
        this._bags.map(async (file, i) => {
          const bagDescriptor = await getBagDescriptor(file);
          return {
            name: "",
            args: { bagDescriptor, prefix: i === 1 ? SECOND_SOURCE_PREFIX : "" },
            children: [],
          };
        }),
      );
      const provider = new CombinedDataProvider({}, bagDescriptors, ({ args }) => {
        const { bagDescriptor, prefix } = args;
        return new RenameDataProvider({ prefix }, NOOP_PROVIDER, () => {
          return new ParseMessagesDataProvider({}, NOOP_PROVIDER, () => {
            return new RewriteBinaryDataProvider({}, NOOP_PROVIDER, () => {
              return new BagDataProvider(
                { bagPath: bagDescriptor, cacheSizeInBytes: Infinity },
                [],
              );
            });
          });
        });
      });
      provider
        .initialize({
          progressCallback: () => {
            // no-op
          },
          reportMetadataCallback: () => {
            // no-op
          },
        })
        .then(async ({ topics, start, end, messageDefinitions }) => {
          const { parsedMessages = [], bobjects = [] } = await provider.getMessages(start, end, {
            bobjects: this._bobjectSubscribedTopics,
            parsedMessages: this._parsedSubscribedTopics,
          });

          if (!parsedMessages || !bobjects) {
            throw new Error("No messages provided.");
          }

          if (messageDefinitions.type === "raw") {
            throw new Error("StoryPlayer requires parsed message definitions");
          }

          listener({
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
              bobjects,
              messageOrder: "receiveTime",
              lastSeekTime: 0,
              speed: 1,
              isPlaying: false,
              playerWarnings: {},
              totalBytesReceived: 0,
            },
          });
        });
    })();
  }

  setSubscriptions(subscriptions: SubscribePayload[]) {
    const [bobjectSubscriptions, parsedSubscriptions] = partition(
      subscriptions,
      ({ format }) => format === "bobjects",
    );
    this._parsedSubscribedTopics = parsedSubscriptions.map(({ topic }) => topic);
    this._bobjectSubscribedTopics = bobjectSubscriptions.map(({ topic }) => topic);
  }

  close = noop;
  setPublishers = noop;
  publish = noop;
  startPlayback = noop;
  pausePlayback = noop;
  setPlaybackSpeed = noop;
  seekPlayback = noop;
  requestBackfill = noop;
  setGlobalVariables = noop;
}
