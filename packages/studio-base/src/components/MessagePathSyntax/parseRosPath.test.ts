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

import parseRosPath from "./parseRosPath";

// Nearley parser returns nulls
// eslint-disable-next-line no-restricted-syntax
const MISSING = null;

describe("parseRosPath", () => {
  it("parses valid strings", () => {
    expect(parseRosPath("/some0/nice_topic.with[99].stuff[0]")).toEqual({
      topicName: "/some0/nice_topic",
      messagePath: [
        { type: "name", name: "with" },
        { type: "slice", start: 99, end: 99 },
        { type: "name", name: "stuff" },
        { type: "slice", start: 0, end: 0 },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/some0/nice_topic.with[99].stuff[0].@derivative")).toEqual({
      topicName: "/some0/nice_topic",
      messagePath: [
        { type: "name", name: "with" },
        { type: "slice", start: 99, end: 99 },
        { type: "name", name: "stuff" },
        { type: "slice", start: 0, end: 0 },
      ],
      modifier: "derivative",
    });
    expect(parseRosPath("some0/nice_topic.with[99].stuff[0]")).toEqual({
      topicName: "some0/nice_topic",
      messagePath: [
        { type: "name", name: "with" },
        { type: "slice", start: 99, end: 99 },
        { type: "name", name: "stuff" },
        { type: "slice", start: 0, end: 0 },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("some_nice_topic")).toEqual({
      topicName: "some_nice_topic",
      messagePath: [],
      modifier: MISSING,
    });
  });

  it("parses slices", () => {
    expect(parseRosPath("/topic.foo[0].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 0, end: 0 },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[1:3].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 1, end: 3 },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[1:].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 1, end: Infinity },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[:10].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 0, end: 10 },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[:].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 0, end: Infinity },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[$a].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "slice",
          start: { variableName: "a", startLoc: "/topic.foo[".length },
          end: { variableName: "a", startLoc: "/topic.foo[".length },
        },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[$a:$b].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "slice",
          start: { variableName: "a", startLoc: "/topic.foo[".length },
          end: { variableName: "b", startLoc: "/topic.foo[$a:".length },
        },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[$a:].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "slice",
          start: { variableName: "a", startLoc: "/topic.foo[".length },
          end: Infinity,
        },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[$a:5].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: { variableName: "a", startLoc: "/topic.foo[".length }, end: 5 },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[:$b].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 0, end: { variableName: "b", startLoc: "/topic.foo[:".length } },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo[2:$b].bar")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        { type: "slice", start: 2, end: { variableName: "b", startLoc: "/topic.foo[2:".length } },
        { type: "name", name: "bar" },
      ],
      modifier: MISSING,
    });
  });

  it("parses filters", () => {
    expect(
      parseRosPath(
        "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{bar==-1}.d{bar==false}.e[:]{bar.baz==true}",
      ),
    ).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "filter",
          path: ["bar"],
          value: "baz",
          nameLoc: "/topic.foo{".length,
          valueLoc: "/topic.foo{bar==".length,
          repr: "bar=='baz'",
        },
        { type: "name", name: "a" },
        {
          type: "filter",
          path: ["bar"],
          value: "baz",
          nameLoc: "/topic.foo{bar=='baz'}.a{".length,
          valueLoc: "/topic.foo{bar=='baz'}.a{bar==".length,
          repr: 'bar=="baz"',
        },
        { type: "name", name: "b" },
        {
          type: "filter",
          path: ["bar"],
          value: 3n,
          nameLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{".length,
          valueLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==".length,
          repr: "bar==3",
        },
        { type: "name", name: "c" },
        {
          type: "filter",
          path: ["bar"],
          value: -1n,
          nameLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{".length,
          valueLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{bar==".length,
          repr: "bar==-1",
        },
        { type: "name", name: "d" },
        {
          type: "filter",
          path: ["bar"],
          value: false,
          nameLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{bar==-1}.d{".length,
          valueLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{bar==-1}.d{bar==".length,
          repr: "bar==false",
        },
        { type: "name", name: "e" },
        { type: "slice", start: 0, end: Infinity },
        {
          type: "filter",
          path: ["bar", "baz"],
          value: true,
          nameLoc: "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{bar==-1}.d{bar==false}.e[:]{"
            .length,
          valueLoc:
            "/topic.foo{bar=='baz'}.a{bar==\"baz\"}.b{bar==3}.c{bar==-1}.d{bar==false}.e[:]{bar.baz=="
              .length,
          repr: "bar.baz==true",
        },
      ],
      modifier: MISSING,
    });
  });

  it("parses filters on top level topic", () => {
    expect(parseRosPath("/topic{foo=='bar'}{baz==2}.a[3].b{x=='y'}")).toEqual({
      topicName: "/topic",
      messagePath: [
        {
          type: "filter",
          path: ["foo"],
          value: "bar",
          nameLoc: "/topic{".length,
          valueLoc: "/topic{foo==".length,
          repr: "foo=='bar'",
        },
        {
          type: "filter",
          path: ["baz"],
          value: 2n,
          nameLoc: "/topic{foo=='bar'}{".length,
          valueLoc: "/topic{foo=='bar'}{baz==".length,
          repr: "baz==2",
        },
        { type: "name", name: "a" },
        { type: "slice", start: 3, end: 3 },
        { type: "name", name: "b" },
        {
          type: "filter",
          path: ["x"],
          value: "y",
          nameLoc: "/topic{foo=='bar'}{baz==2}.a[3].b{".length,
          valueLoc: "/topic{foo=='bar'}{baz==2}.a[3].b{x==".length,
          repr: "x=='y'",
        },
      ],
      modifier: MISSING,
    });
  });

  it("parses filters with global variables", () => {
    expect(parseRosPath("/topic.foo{bar==$}.a{bar==$my_var_1}")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "filter",
          path: ["bar"],
          value: { variableName: "", startLoc: "/topic.foo{bar==".length },
          nameLoc: "/topic.foo{".length,
          valueLoc: "/topic.foo{bar==".length,
          repr: "bar==$",
        },
        { type: "name", name: "a" },
        {
          type: "filter",
          path: ["bar"],
          value: { variableName: "my_var_1", startLoc: "/topic.foo{bar==$}.a{bar==".length },
          nameLoc: "/topic.foo{bar==$}.a{".length,
          valueLoc: "/topic.foo{bar==$}.a{bar==".length,
          repr: "bar==$my_var_1",
        },
      ],
      modifier: MISSING,
    });
  });

  it("parses unfinished strings", () => {
    expect(parseRosPath("/")).toEqual({ topicName: "/", messagePath: [], modifier: MISSING });
    expect(parseRosPath("/topic.")).toEqual({
      topicName: "/topic",
      messagePath: [{ type: "name", name: "" }],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.hi.")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "hi" },
        { type: "name", name: "" },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.hi.@")).toEqual({
      topicName: "/topic",
      messagePath: [{ type: "name", name: "hi" }],
      modifier: "",
    });
    expect(parseRosPath("/topic.foo{}")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "filter",
          path: [],
          value: undefined,
          nameLoc: "/topic.foo{".length,
          valueLoc: "/topic.foo{".length,
          repr: "",
        },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo{bar}")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "filter",
          path: ["bar"],
          value: undefined,
          nameLoc: "/topic.foo{".length,
          valueLoc: "/topic.foo{".length,
          repr: "bar",
        },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo{==1}")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "filter",
          path: [],
          value: 1n,
          nameLoc: "/topic.foo{".length,
          valueLoc: "/topic.foo{==".length,
          repr: "==1",
        },
      ],
      modifier: MISSING,
    });
    expect(parseRosPath("/topic.foo{==-3}")).toEqual({
      topicName: "/topic",
      messagePath: [
        { type: "name", name: "foo" },
        {
          type: "filter",
          path: [],
          value: -3n,
          nameLoc: "/topic.foo{".length,
          valueLoc: "/topic.foo{==".length,
          repr: "==-3",
        },
      ],
      modifier: MISSING,
    });
  });

  it("parses simple valid strings", () => {
    expect(parseRosPath("blah")).toBeDefined();
    expect(parseRosPath("100")).toBeDefined();
    expect(parseRosPath("blah.blah")).toBeDefined();
  });

  it("returns undefined for invalid strings", () => {
    expect(parseRosPath("-100")).toBeUndefined();
    expect(parseRosPath("[100]")).toBeUndefined();
    expect(parseRosPath("[-100]")).toBeUndefined();
    expect(parseRosPath("/topic.no.2d.arrays[0][1]")).toBeUndefined();
    expect(parseRosPath("/topic.foo[].bar")).toBeUndefined();
    expect(parseRosPath("/topic.foo[bar]")).toBeUndefined();
    expect(parseRosPath("/topic.foo{bar==}")).toBeUndefined();
    expect(parseRosPath("/topic.foo{bar==baz}")).toBeUndefined();
  });
});
