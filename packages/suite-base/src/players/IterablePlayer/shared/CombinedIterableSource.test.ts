// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";
import { MessageEvent } from "@lichtblick/suite";
import {
  GetBackfillMessagesArgs,
  ISerializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";

import { CombinedIterableSource } from "./CombinedIterableSource";

type FakeSourceOptions = {
  start: Time;
  end: Time;
  topic: string;
  schemaName: string;
  /** Receive-time seconds at which this source emits a message. */
  messageSeconds: number[];
  reportTimeRange?: boolean;
};

class FakeSource implements ISerializedIterableSource {
  public readonly sourceType = "serialized";
  readonly #opts: FakeSourceOptions;

  public constructor(opts: FakeSourceOptions) {
    this.#opts = opts;
  }

  public getStart(): Time | undefined {
    return this.#opts.reportTimeRange === false ? undefined : this.#opts.start;
  }

  public getEnd(): Time | undefined {
    return this.#opts.reportTimeRange === false ? undefined : this.#opts.end;
  }

  public async initialize(): Promise<Initialization> {
    return {
      start: this.#opts.start,
      end: this.#opts.end,
      topics: [{ name: this.#opts.topic, schemaName: this.#opts.schemaName }],
      topicStats: new Map([[this.#opts.topic, { numMessages: this.#opts.messageSeconds.length }]]),
      profile: undefined,
      alerts: [],
      datatypes: new Map([[this.#opts.schemaName, { definitions: [] }]]),
      publishersByTopic: new Map(),
    };
  }

  public async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>> {
    for (const sec of this.#opts.messageSeconds) {
      yield {
        type: "message-event",
        msgEvent: {
          topic: this.#opts.topic,
          schemaName: this.#opts.schemaName,
          receiveTime: { sec, nsec: 0 },
          publishTime: { sec, nsec: 0 },
          message: new Uint8Array([sec]),
          sizeInBytes: 1,
        },
      };
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<Uint8Array>[]> {
    if (!args.topics.has(this.#opts.topic)) {
      return [];
    }

    const lastSec = this.#opts.messageSeconds.filter((sec) => sec <= args.time.sec).at(-1);
    if (lastSec == undefined) {
      return [];
    }
    return [
      {
        topic: this.#opts.topic,
        schemaName: this.#opts.schemaName,
        receiveTime: { sec: lastSec, nsec: 0 },
        publishTime: { sec: lastSec, nsec: 0 },
        message: new Uint8Array([lastSec]),
        sizeInBytes: 1,
      },
    ];
  }
}

async function collect(
  iterator: AsyncIterableIterator<Readonly<IteratorResult<Uint8Array>>>,
): Promise<number[]> {
  const secs: number[] = [];
  for await (const result of iterator) {
    if (result.type === "message-event") {
      secs.push(result.msgEvent.receiveTime.sec);
    }
  }
  return secs;
}

describe("CombinedIterableSource", () => {
  describe("initialize", () => {
    it("should merge initializations of all sources", async () => {
      // Given
      const mcap = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/mcap",
        schemaName: "Mcap",
        messageSeconds: [0, 2, 4],
      });
      const tags = new FakeSource({
        start: { sec: 1, nsec: 0 },
        end: { sec: 3, nsec: 0 },
        topic: "/tags",
        schemaName: "Tags",
        messageSeconds: [1, 3],
        reportTimeRange: false,
      });
      const combined = new CombinedIterableSource(mcap, [tags]);

      // When
      const init = await combined.initialize();

      // Then
      expect(init.start).toEqual({ sec: 0, nsec: 0 });
      expect(init.end).toEqual({ sec: 4, nsec: 0 });
      expect(init.topics.map((t) => t.name).sort()).toEqual(["/mcap", "/tags"]);
      expect(init.datatypes.has("Mcap")).toBe(true);
      expect(init.datatypes.has("Tags")).toBe(true);
    });

    it("should isolate additional-source init failures without breaking the primary", async () => {
      // Given a failing additional source
      const mcap = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/mcap",
        schemaName: "Mcap",
        messageSeconds: [0, 2, 4],
      });
      const failing = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/tags",
        schemaName: "Tags",
        messageSeconds: [1],
      });
      failing.initialize = jest.fn().mockRejectedValue(new Error("boom"));
      const combined = new CombinedIterableSource(mcap, [failing]);

      // When
      const init = await combined.initialize();

      // Then the primary still initializes and a warning alert is surfaced
      expect(init.topics.map((t) => t.name)).toEqual(["/mcap"]);
      expect(init.alerts).toHaveLength(1);
      expect(init.alerts[0]?.severity).toBe("warn");

      // And the failed source is excluded from iteration
      const order = await collect(
        combined.messageIterator({ topics: new Map() }),
      );
      expect(order).toEqual([0, 2, 4]);
    });

    it("should propagate a primary-source init failure", async () => {
      // Given a failing primary source
      const mcap = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/mcap",
        schemaName: "Mcap",
        messageSeconds: [0],
      });
      mcap.initialize = jest.fn().mockRejectedValue(new Error("primary failed"));
      const combined = new CombinedIterableSource(mcap, []);

      // When / Then
      await expect(combined.initialize()).rejects.toThrow("primary failed");
    });
  });

  describe("messageIterator", () => {
    it("should interleave messages from all sources in receive-time order", async () => {
      // Given an additional source overlapping the whole primary timeline
      const mcap = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/mcap",
        schemaName: "Mcap",
        messageSeconds: [0, 2, 4],
      });
      const tags = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/tags",
        schemaName: "Tags",
        messageSeconds: [1, 3],
      });
      const combined = new CombinedIterableSource(mcap, [tags]);
      await combined.initialize();

      // When
      const order = await collect(
        combined.messageIterator({ topics: new Map() }),
      );

      // Then
      expect(order).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe("getBackfillMessages", () => {
    it("should aggregate backfill messages from all relevant sources", async () => {
      // Given
      const mcap = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/mcap",
        schemaName: "Mcap",
        messageSeconds: [0, 2],
      });
      const tags = new FakeSource({
        start: { sec: 0, nsec: 0 },
        end: { sec: 4, nsec: 0 },
        topic: "/tags",
        schemaName: "Tags",
        messageSeconds: [1],
      });
      const combined = new CombinedIterableSource(mcap, [tags]);
      await combined.initialize();

      // When
      const messages = await combined.getBackfillMessages({
        topics: new Map(["/mcap", "/tags"].map((topic) => [topic, { topic }])),
        time: { sec: 4, nsec: 0 },
      });

      // Then
      expect(messages.map((m) => m.topic).sort()).toEqual(["/mcap", "/tags"]);
    });
  });
});
