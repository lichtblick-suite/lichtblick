/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import FakePlayer from "@lichtblick/suite-base/components/MessagePipeline/FakePlayer";

import { createMessagePipelineStore } from "./store";

describe("createMessagePipelineStore", () => {
  it("should return undefined when the player does not support backfill lookups", async () => {
    // GIVEN - a store backed by a player that cannot answer backfill lookups
    const store = createMessagePipelineStore({
      promisesToWaitForRef: { current: [] },
      initialPlayer: new FakePlayer(),
    });

    // WHEN - requesting a point-in-time message
    const result = await store.getState().public.getMessageAtTime("/topic", {
      sec: 1,
      nsec: 0,
    });

    // THEN - the store reports that the lookup is unsupported
    expect(result).toBeUndefined();
  });

  it("should return the matching backfill message when the player can resolve messages", async () => {
    // GIVEN - a player that can return multiple backfill messages
    const player = new FakePlayer() as FakePlayer & {
      getBackfillMessages: jest.Mock;
    };
    const matchingMessage = {
      topic: "/topic",
      receiveTime: { sec: 1, nsec: 0 },
      message: { value: 2 },
      schemaName: "schema",
      sizeInBytes: 0,
    };
    const otherMessage = {
      topic: "/other",
      receiveTime: { sec: 1, nsec: 0 },
      message: { value: 1 },
      schemaName: "schema",
      sizeInBytes: 0,
    };
    player.getBackfillMessages = jest.fn().mockResolvedValue([otherMessage, matchingMessage]);
    const store = createMessagePipelineStore({
      promisesToWaitForRef: { current: [] },
      initialPlayer: player,
    });

    // WHEN - requesting the message at a specific time for one topic
    const result = await store.getState().public.getMessageAtTime("/topic", {
      sec: 1,
      nsec: 0,
    });

    // THEN - the store asks for that topic and returns the matching message
    expect(player.getBackfillMessages).toHaveBeenCalledWith({
      topics: new Map([["/topic", { topic: "/topic" }]]),
      time: {
        sec: 1,
        nsec: 0,
      },
    });
    expect(result).toEqual(matchingMessage);
  });
});
