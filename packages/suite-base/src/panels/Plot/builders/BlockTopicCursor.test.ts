// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { MessageEvent } from "@lichtblick/suite";

import { BlockTopicCursor } from "./BlockTopicCursor";

function groupByTopic(events: MessageEvent[]): Record<string, MessageEvent[]> {
  return _.groupBy(events, (item) => item.topic);
}

describe("BlockTopicCursor", () => {
  it("should produce next block through repeated calls to next", () => {
    const cursor = new BlockTopicCursor("/foo");

    const block0 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 1,
          },
        },
      ]),
    };

    const block1 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 2,
          },
        },
      ]),
    };

    const blocks = [block0, block1];

    expect(cursor.nextWillReset(blocks)).toEqual(true);
    expect(cursor.next(blocks)).toEqual(block0["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(block1["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(undefined);
  });

  it("should continue from last location when new blocks arrive", () => {
    const cursor = new BlockTopicCursor("/foo");

    const block0 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 1,
          },
        },
      ]),
    };

    const block1 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 2,
          },
        },
      ]),
    };

    expect(cursor.nextWillReset([block0])).toEqual(true);
    expect(cursor.next([block0])).toEqual(block0["messagesByTopic"]["/foo"]);
    expect(cursor.next([block0])).toEqual(undefined);
    expect(cursor.next([block0, block1])).toEqual(block1["messagesByTopic"]["/foo"]);
    expect(cursor.next([block0, block1])).toEqual(undefined);
  });

  it("should restart if either the first or last iterated block of the topic change", () => {
    // When using per-field subscriptions, a particular topic might be populated across all blocks
    // because a field was needed. A cursor will think it has processed all the blocks but a new
    // subscription update will start to update blocks with the new field. We need to properly
    // detect this happening - that the block is changed.

    const cursor = new BlockTopicCursor("/foo");

    const block0 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 1,
          },
        },
      ]),
    };

    const block1 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 2,
          },
        },
      ]),
    };

    const block2 = {
      sizeInBytes: 0,
      messagesByTopic: groupByTopic([
        {
          topic: "/foo",
          schemaName: "foo",
          receiveTime: { sec: 0, nsec: 0 },
          sizeInBytes: 0,
          message: {
            val: 3,
          },
        },
      ]),
    };

    const blocks = [block0, block1, block2];

    // consume all the blocks because the topic is present in all blocks
    expect(cursor.nextWillReset(blocks)).toEqual(true);
    expect(cursor.next(blocks)).toEqual(block0["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(block1["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(block2["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(undefined);
    expect(cursor.nextWillReset(blocks)).toEqual(false);

    // The first block is changed, we should reset
    block0.messagesByTopic["/foo"] = [
      {
        topic: "/foo",
        schemaName: "foo",
        receiveTime: { sec: 0, nsec: 0 },
        sizeInBytes: 0,
        message: {
          val: 1,
          another: 2,
        },
      },
    ];

    expect(cursor.nextWillReset(blocks)).toEqual(true);
    expect(cursor.next(blocks)).toEqual(block0["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(block1["messagesByTopic"]["/foo"]);

    // The last block we produced changed, we also need to reset
    block1.messagesByTopic["/foo"] = [
      {
        topic: "/foo",
        schemaName: "foo",
        receiveTime: { sec: 0, nsec: 0 },
        sizeInBytes: 0,
        message: {
          val: 2,
          another: 3,
        },
      },
    ];

    expect(cursor.nextWillReset(blocks)).toEqual(true);
    expect(cursor.next(blocks)).toEqual(block0["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(block1["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(block2["messagesByTopic"]["/foo"]);
    expect(cursor.next(blocks)).toEqual(undefined);
    expect(cursor.nextWillReset(blocks)).toEqual(false);
  });
});
