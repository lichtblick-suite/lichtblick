// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";

import { stringifyMessagePath } from "./stringifyRosPath";

describe("stringifyRosPath", () => {
  const paths = [
    "/some0/nice_topic.with[99].stuff[0]",
    "/some0/nice_topic.with[99].stuff[0].@derivative",
    "some0/nice_topic.with[99].stuff[0]",
    "some_nice_topic",
    String.raw`"/foo/bar".baz`,
    String.raw`"\"".baz`,
    "/topic.foo[0].bar",
    "/topic.foo[1:3].bar",
    "/topic.foo[1:].bar",
    "/topic.foo[:10].bar",
    "/topic.foo[:].bar",
    "/topic.foo[$a].bar",
    "/topic.foo[$a:$b].bar",
    "/topic.foo[$a:5].bar",
    "/topic.foo[$a:].bar",
    '/topic.foo{bar=="baz"}.a{bar=="baz"}.b{bar==3}.c{bar==-1}.d{bar==false}.e[:]{bar.baz==true}',
    '/topic{foo=="bar"}{baz==2}.a[3].b{x=="y"}',
    "/topic.foo{bar==$}.a{bar.baz==$my_var_1}",
  ];
  it.each(paths)("returns original string for: %s", (str) => {
    expect(stringifyMessagePath(parseMessagePath(str)!)).toEqual(str);
  });

  it.each([
    { path: "/topic.foo[$num1].bar", expected: "/topic.foo[1].bar" },
    { path: "/topic.foo[$num1:$num2].bar", expected: "/topic.foo[1:2].bar" },
    { path: "/topic.foo{bar==$num1}.baz", expected: "/topic.foo{bar==1}.baz" },
    { path: "/topic.foo{bar==$str}.baz", expected: '/topic.foo{bar=="foo"}.baz' },
  ])("turns $path with variables into $expected", ({ path, expected }) => {
    // note: only string and number are currently supported by fillInGlobalVariablesInPath
    const globalVariables = { str: "foo", num1: 1, num2: 2 };
    expect(
      stringifyMessagePath(fillInGlobalVariablesInPath(parseMessagePath(path)!, globalVariables)),
    ).toEqual(expected);
  });
});
