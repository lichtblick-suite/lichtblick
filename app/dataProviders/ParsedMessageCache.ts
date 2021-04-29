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

import { MessageReader } from "@foxglove-studio/app/dataProviders/types";
import { TypedMessage } from "@foxglove-studio/app/players/types";
import filterMap from "@foxglove-studio/app/util/filterMap";
import sendNotification from "@foxglove-studio/app/util/sendNotification";
import { toSec } from "@foxglove-studio/app/util/time";

// Amount of parsed messages measured in unparsed message size that we keep cached.
// Exported for tests.
export const CACHE_SIZE_BYTES = 200e6;

function readMessage(
  messageEvent: TypedMessage<ArrayBuffer>,
  readersByTopic: Readonly<{
    [topic: string]: MessageReader;
  }>,
): TypedMessage<unknown> | undefined {
  const reader = readersByTopic[messageEvent.topic];
  if (!reader) {
    throw new Error(`Could not find message reader for topic ${messageEvent.topic}`);
  }
  try {
    // builtin rosbag reader requires Buffer type
    // when we switch tests to lazy message reader we can use Uint8Array
    return { ...messageEvent, message: reader.readMessage(Buffer.from(messageEvent.message)) };
  } catch (error) {
    sendNotification(
      `Error reading messages from ${messageEvent.topic}: ${error.message}`,
      error,
      "user",
      "warn",
    );
    return undefined;
  }
}

type Cache = {
  map: WeakMap<TypedMessage<unknown>, TypedMessage<unknown>>;
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
    messageEvents: readonly TypedMessage<ArrayBuffer>[],
    readersByTopic: Readonly<{
      [topic: string]: MessageReader;
    }>,
  ): TypedMessage<unknown>[] {
    const outputMessages: TypedMessage<unknown>[] = filterMap(messageEvents, (messageEvent) => {
      // Use strings like "123.4" as the cache keys.
      const deciSecond = Math.trunc(toSec(messageEvent.receiveTime) * 10);

      // Initialize the cache.
      const cache = (this._cachesByDeciSecond[deciSecond] = this._cachesByDeciSecond[
        deciSecond
      ] ?? {
        map: new WeakMap(),
        lastAccessIndex: 0,
        sizeInBytes: 0,
      });

      // Update the access time.
      cache.lastAccessIndex = this._cacheAccessIndex++;

      let outputMessage: TypedMessage<unknown> | undefined = cache.map.get(messageEvent);
      if (!outputMessage) {
        outputMessage = readMessage(messageEvent, readersByTopic);
        if (outputMessage) {
          cache.map.set(messageEvent, outputMessage);
          const messageSize = messageEvent.message.byteLength;
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
