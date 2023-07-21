// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";
import {
  PlayerPresence,
  PlayerState,
  PlayerStateActiveData,
} from "@foxglove/studio-base/players/types";

export function mockMessage<T>(message: T, fields?: Partial<MessageEvent<T>>): MessageEvent<T> {
  return {
    topic: "topic",
    schemaName: "schema",
    receiveTime: { sec: 0, nsec: 0 },
    message,
    sizeInBytes: 1,
    ...fields,
  };
}

export function mockPlayerState(
  overrides?: Partial<PlayerState>,
  dataOverrides?: Partial<PlayerStateActiveData>,
): PlayerState {
  return {
    activeData: {
      messages: [],
      currentTime: { sec: 0, nsec: 0 },
      endTime: { sec: 0, nsec: 0 },
      lastSeekTime: 1,
      topics: [],
      speed: 1,
      isPlaying: false,
      topicStats: new Map(),
      startTime: { sec: 0, nsec: 0 },
      datatypes: new Map(),
      totalBytesReceived: 0,
      ...dataOverrides,
    },
    capabilities: [],
    presence: PlayerPresence.PRESENT,
    profile: undefined,
    playerId: "1",
    progress: {
      fullyLoadedFractionRanges: [],
      messageCache: undefined,
    },
    ...overrides,
  };
}
