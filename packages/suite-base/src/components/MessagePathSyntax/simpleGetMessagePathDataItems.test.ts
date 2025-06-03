// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseMessagePath } from "@lichtblick/message-path";
import { MessageEvent } from "@lichtblick/suite";

import { simpleGetMessagePathDataItems } from "./simpleGetMessagePathDataItems";

describe("simpleGetMessagePathDataItems", () => {
  it("returns root message if topic matches", () => {
    const message: MessageEvent = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      schemaName: "datatype",
      message: { foo: 42 },
    };
    expect(simpleGetMessagePathDataItems(message, parseMessagePath("/foo")!)).toEqual([
      { foo: 42 },
    ]);
    expect(simpleGetMessagePathDataItems(message, parseMessagePath("/bar")!)).toEqual([]);
  });

  it("supports TypedArray messages", () => {
    const message: MessageEvent = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      schemaName: "datatype",
      message: {
        bar: new Uint32Array([3, 4, 5]),
      },
    };
    expect(simpleGetMessagePathDataItems(message, parseMessagePath("/foo.bar")!)).toEqual([
      new Uint32Array([3, 4, 5]),
    ]);
    expect(simpleGetMessagePathDataItems(message, parseMessagePath("/foo.bar[0]")!)).toEqual([3]);
  });

  it("returns correct nested values", () => {
    const message: MessageEvent = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      schemaName: "datatype",
      message: {
        foo: {
          bars: [
            { id: 1, name: "bar1" },
            { id: 1, name: "bar1-2" },
            { id: 2, name: "bar2" },
          ],
        },
      },
    };

    expect(
      simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.bars[:]{id==1}")!),
    ).toEqual([
      { id: 1, name: "bar1" },
      { id: 1, name: "bar1-2" },
    ]);
    expect(
      simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.bars[:]{id==1}.name")!),
    ).toEqual(["bar1", "bar1-2"]);
    expect(
      simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.bars[:]{id==2}")!),
    ).toEqual([{ id: 2, name: "bar2" }]);
    expect(
      simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.bars[:]{id==2}.name")!),
    ).toEqual(["bar2"]);
  });

  it("returns nothing for missing fields", () => {
    const message: MessageEvent = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      schemaName: "datatype",
      message: { foo: 1 },
    };
    expect(simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.baz.hello")!)).toEqual(
      [],
    );
  });

  it("throws for unsupported paths", () => {
    const message: MessageEvent = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      schemaName: "datatype",
      message: {
        foo: {
          bars: [
            { id: 1, name: "bar1" },
            { id: 1, name: "bar1-2" },
            { id: 2, name: "bar2" },
          ],
        },
      },
    };

    expect(() =>
      simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.bars[:]{id==$id}")!),
    ).toThrow("filterMatches only works on paths where global variables have been filled in");
    expect(() =>
      simpleGetMessagePathDataItems(message, parseMessagePath("/foo.foo.bars[$id]")!),
    ).toThrow("Variables in slices are not supported");
  });
});
