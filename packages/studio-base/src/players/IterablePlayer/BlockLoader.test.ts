/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import { MessageEvent } from "@foxglove/studio-base/players/types";

import { BlockLoader } from "./BlockLoader";
import {
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
} from "./IIterableSource";

class TestSource implements IIterableSource {
  async initialize(): Promise<Initalization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 1, nsec: 0 },
      topics: [],
      topicStats: new Map(),
      problems: [],
      profile: undefined,
      datatypes: new Map(),
      publishersByTopic: new Map(),
    };
  }

  async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {}

  async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}

describe("BlockLoader", () => {
  it("should make an empty block loader", async () => {
    const loader = new BlockLoader({
      maxBlocks: 1,
      cacheSizeBytes: 1,
      minBlockDurationNs: 1,
      source: new TestSource(),
      start: { sec: 0, nsec: 0 },
      end: { sec: 0, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const abort = new AbortController();
    await loader.load({
      abortSignal: abort.signal,
      startTime: { sec: 0, nsec: 0 },
      progress: async (progress) => {
        expect(progress).toEqual({
          fullyLoadedFractionRanges: [],
          messageCache: {
            blocks: [undefined],
            startTime: { sec: 0, nsec: 0 },
          },
        });
      },
    });

    expect.assertions(1);
  });

  it("should limit to min block duration ns", async () => {
    const loader = new BlockLoader({
      maxBlocks: 5,
      cacheSizeBytes: 1,
      minBlockDurationNs: 2000000000,
      source: new TestSource(),
      start: { sec: 0, nsec: 0 },
      end: { sec: 5, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const abort = new AbortController();
    await loader.load({
      abortSignal: abort.signal,
      startTime: { sec: 0, nsec: 0 },
      progress: async (progress) => {
        expect(progress).toEqual({
          fullyLoadedFractionRanges: [],
          messageCache: {
            blocks: [undefined, undefined, undefined],
            startTime: { sec: 0, nsec: 0 },
          },
        });
      },
    });

    expect.assertions(1);
  });

  it("should mark blocks as loaded when there are no messages", async () => {
    const loader = new BlockLoader({
      maxBlocks: 5,
      cacheSizeBytes: 1,
      minBlockDurationNs: 1,
      source: new TestSource(),
      start: { sec: 0, nsec: 0 },
      end: { sec: 5, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    loader.setTopics(new Set(["foo"]));

    const abort = new AbortController();
    await loader.load({
      abortSignal: abort.signal,
      startTime: { sec: 0, nsec: 0 },
      progress: async (progress) => {
        expect(progress).toEqual({
          fullyLoadedFractionRanges: [
            {
              start: 0,
              end: 1,
            },
          ],
          messageCache: {
            blocks: [
              {
                messagesByTopic: {
                  foo: [],
                },
                sizeInBytes: 0,
              },
              {
                messagesByTopic: {
                  foo: [],
                },
                sizeInBytes: 0,
              },
              {
                messagesByTopic: {
                  foo: [],
                },
                sizeInBytes: 0,
              },
              {
                messagesByTopic: {
                  foo: [],
                },
                sizeInBytes: 0,
              },
              {
                messagesByTopic: {
                  foo: [],
                },
                sizeInBytes: 0,
              },
            ],
            startTime: { sec: 0, nsec: 0 },
          },
        });
      },
    });

    expect.assertions(1);
  });
});
