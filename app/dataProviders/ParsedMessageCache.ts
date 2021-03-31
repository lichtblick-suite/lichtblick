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

import { sortBy } from "lodash";
import { MessageReader } from "rosbag";

import { Message } from "@foxglove-studio/app/players/types";
import { deepParse, inaccurateByteSize, isBobject } from "@foxglove-studio/app/util/binaryObjects";
import filterMap from "@foxglove-studio/app/util/filterMap";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import { toSec } from "@foxglove-studio/app/util/time";

// Amount of parsed messages measured in unparsed message size that we keep cached.
// Exported for tests.
export const CACHE_SIZE_BYTES = 200e6;

function readMessage(
  message: Message,
  readersByTopic: Readonly<{
    [topic: string]: MessageReader;
  }>,
): Message | undefined {
  if (isBobject(message.message)) {
    return { ...message, message: deepParse(message.message) };
  }
  const reader = readersByTopic[message.topic];
  if (!reader) {
    throw new Error(`Could not find message reader for topic ${message.topic}`);
  }
  try {
    return { ...message, message: reader.readMessage(Buffer.from(message.message as any)) };
  } catch (error) {
    sendNotification(
      `Error reading messages from ${message.topic}: ${error.message}`,
      error,
      "user",
      "warn",
    );
    return undefined;
  }
}

type Cache = {
  map: WeakMap<Message, Message>;
  lastAccessIndex: number;
  sizeInBytes: number;
};

export default class ParsedMessageCache {
  // Simple LRU cache that maps raw messages to parsed messages. Uses strings like "123.4" as the cache keys.
  _cachesByDeciSecond: {
    [deciSecond: number]: Cache;
  } = {};

  // A number that increases on every access; for use in `lastAccessIndex`.
  _cacheAccessIndex: number = 1;

  // Total size in bytes from all the _cachesByDeciSecond.
  _cacheSizeInBytes: number = 0;

  parseMessages(
    messages: readonly Message[],
    readersByTopic: Readonly<{
      [topic: string]: MessageReader;
    }>,
  ): Message[] {
    const outputMessages: Message[] = filterMap(messages, (message) => {
      // Use strings like "123.4" as the cache keys.
      const deciSecond = Math.trunc(toSec(message.receiveTime) * 10);

      // Initialize the cache.
      const cache = (this._cachesByDeciSecond[deciSecond] = this._cachesByDeciSecond[
        deciSecond
      ] || {
        map: new WeakMap(),
        lastAccessIndex: 0,
        sizeInBytes: 0,
      });

      // Update the access time.
      cache.lastAccessIndex = this._cacheAccessIndex++;

      let outputMessage: Message | undefined = cache.map.get(message);
      if (!outputMessage) {
        outputMessage = readMessage(message, readersByTopic);
        if (outputMessage) {
          cache.map.set(message, outputMessage);
          const messageSize = isBobject(message.message)
            ? inaccurateByteSize(message.message)
            : (message.message.byteLength as number);
          cache.sizeInBytes += messageSize;
          this._cacheSizeInBytes += messageSize;
        }
      }

      return outputMessage;
    });

    if (this._cacheSizeInBytes > CACHE_SIZE_BYTES) {
      // Delete the least recently used caches, once they exceed CACHE_SIZE_BYTES.
      const cacheEntries = (Object.entries(this._cachesByDeciSecond) as any) as [number, Cache][];
      const sortedCaches = sortBy(cacheEntries, (val) => -val[1].lastAccessIndex);
      let totalBytes = 0;
      for (const [deciSecond, { sizeInBytes }] of sortedCaches) {
        totalBytes += sizeInBytes;
        if (totalBytes > CACHE_SIZE_BYTES) {
          this._cacheSizeInBytes -= sizeInBytes;
          delete this._cachesByDeciSecond[deciSecond];
        }
      }
    }

    return outputMessages;
  }
}
