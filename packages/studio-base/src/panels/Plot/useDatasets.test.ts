// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";

import { pathToPayload } from "./useDatasets";

describe("getPayload", () => {
  const call = (path: string) => {
    const parsed = parseRosPath(path);
    if (parsed == undefined) {
      throw new Error(`invalid path: ${path}`);
    }

    return pathToPayload(parsed);
  };
  it("ignores path without a property", () => {
    expect(call("/foo")).toEqual(undefined);
  });
  it("subscribes to one field", () => {
    expect(call("/foo.bar")).toEqual({
      topic: "/foo",
      fields: ["bar", "header"],
    });
  });
  it("subscribes to field and filter", () => {
    expect(call("/foo{baz==2}.bar")).toEqual({
      topic: "/foo",
      fields: ["baz", "bar", "header"],
    });
  });
  it("subscribes to multiple filters", () => {
    expect(call("/foo{baz==2}{fox==3}.bar")).toEqual({
      topic: "/foo",
      fields: ["baz", "fox", "bar", "header"],
    });
  });
  it("should ignore filters that come later", () => {
    expect(call("/foo{fox==3}.bar{blah==2}")).toEqual({
      topic: "/foo",
      fields: ["fox", "bar", "header"],
    });
  });
});
