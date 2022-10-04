// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";

import parseRosPath from "./parseRosPath";
import { simpleGetMessagePathDataItems } from "./simpleGetMessagePathDataItems";

describe("simpleGetMessagePathDataItems", () => {
  it("returns root message if topic matches", () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      datatype: "datatype",
      message: { foo: 42 },
    };
    expect(simpleGetMessagePathDataItems(message, parseRosPath("/foo")!)).toEqual([{ foo: 42 }]);
    expect(simpleGetMessagePathDataItems(message, parseRosPath("/bar")!)).toEqual([]);
  });

  it("returns correct nested values", () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      datatype: "datatype",
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
      simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.bars[:]{id==1}")!),
    ).toEqual([
      { id: 1, name: "bar1" },
      { id: 1, name: "bar1-2" },
    ]);
    expect(
      simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.bars[:]{id==1}.name")!),
    ).toEqual(["bar1", "bar1-2"]);
    expect(
      simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.bars[:]{id==2}")!),
    ).toEqual([{ id: 2, name: "bar2" }]);
    expect(
      simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.bars[:]{id==2}.name")!),
    ).toEqual(["bar2"]);
  });

  it("returns nothing for missing fields", () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      datatype: "datatype",
      message: { foo: 1 },
    };
    expect(simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.baz.hello")!)).toEqual([]);
  });

  it("throws for unsupported paths", () => {
    const message: MessageEvent<unknown> = {
      topic: "/foo",
      receiveTime: { sec: 0, nsec: 0 },
      sizeInBytes: 0,
      datatype: "datatype",
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
      simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.bars[:]{id==$id}")!),
    ).toThrow("filterMatches only works on paths where global variables have been filled in");
    expect(() =>
      simpleGetMessagePathDataItems(message, parseRosPath("/foo.foo.bars[$id]")!),
    ).toThrow("Variables in slices are not supported");
  });
});
