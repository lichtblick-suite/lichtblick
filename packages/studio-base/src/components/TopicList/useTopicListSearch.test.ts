/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import { TopicListItem, UseTopicListSearchParams, useTopicListSearch } from "./useTopicListSearch";

function itemToString(topicListItem: TopicListItem): string {
  switch (topicListItem.type) {
    case "topic":
      return topicListItem.item.item.name;
    case "schema":
      return topicListItem.item.item.fullPath;
  }
}

describe("useTopicListSearch", () => {
  it("sorts topics with matches above matching paths", () => {
    const topics: UseTopicListSearchParams["topics"] = [
      { name: "abc", schemaName: "ABCD" },
      { name: "xyz", schemaName: "XYZW" },
    ];
    const datatypes: UseTopicListSearchParams["datatypes"] = new Map([
      ["ABCD", { definitions: [{ name: "xyz", type: "string" }] }],
      ["XYZW", { definitions: [{ name: "abcd", type: "string" }] }],
    ]);
    const { result } = renderHook(() =>
      useTopicListSearch({ topics, datatypes, filterText: "xyz" }),
    );
    expect(result.current.map(itemToString)).toEqual(["xyz", "abc", "abc.xyz"]);
  });

  it("sorts topics with matching schema names above matching paths", () => {
    const topics: UseTopicListSearchParams["topics"] = [
      { name: "abc", schemaName: "ABCD" },
      { name: "xyz", schemaName: "XYZW" },
    ];
    const datatypes: UseTopicListSearchParams["datatypes"] = new Map([
      ["ABCD", { definitions: [{ name: "xyz", type: "string" }] }],
      ["XYZW", { definitions: [{ name: "abcd", type: "string" }] }],
    ]);
    const { result } = renderHook(() => useTopicListSearch({ topics, datatypes, filterText: "d" }));
    expect(result.current.map(itemToString)).toEqual(["abc", "xyz", "xyz.abcd"]);
  });

  it("sorts better matches to the top", () => {
    const topics: UseTopicListSearchParams["topics"] = [
      { name: "footballer", schemaName: "ABCD" },
      { name: "xyz", schemaName: "XYZW" },
    ];
    const datatypes: UseTopicListSearchParams["datatypes"] = new Map([
      ["ABCD", { definitions: [{ name: "lmnop", type: "string" }] }],
      ["XYZW", { definitions: [{ name: "foobar", type: "string" }] }],
    ]);
    const { result } = renderHook(() =>
      useTopicListSearch({ topics, datatypes, filterText: "foobar" }),
    );
    expect(result.current.map(itemToString)).toEqual(["xyz", "xyz.foobar", "footballer"]);
  });
});
