/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react";

import { InspectionTopic } from "./types";
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
  const nativeTopic = (channelId: string): InspectionTopic => ({
    name: "/shared",
    channelId,
    schemaName: "Input",
    channel: { id: channelId, topic: "/shared", schemaName: "Input", source: { kind: "native" } },
  });
  const convertedTopic = (inputChannelId: string, converterId: string): InspectionTopic => ({
    name: "/shared",
    channelId: `${inputChannelId}-${converterId}`,
    schemaName: "Output",
    channel: {
      id: `${inputChannelId}-${converterId}`,
      topic: "/shared",
      schemaName: "Output",
      source: { kind: "converted", inputChannelId, converterId },
    },
  });

  it("groups converted outputs beneath their exact source despite interleaved channel IDs", () => {
    const topics = [
      convertedTopic("z", "second"),
      nativeTopic("z-other"),
      convertedTopic("z", "first"),
      nativeTopic("z"),
      convertedTopic("z-other", "first"),
    ];
    const { result } = renderHook(() =>
      useTopicListSearch({ topics, datatypes: new Map(), filterText: "" }),
    );
    expect(result.current.map((row) => row.type === "topic" && row.item.item.channelId)).toEqual([
      "z",
      "z-first",
      "z-second",
      "z-other",
      "z-other-first",
    ]);
  });

  it("keeps the source as search context without including unmatched converted siblings", () => {
    const topics = [
      nativeTopic("z"),
      convertedTopic("z", "first"),
      convertedTopic("z", "uniqueXYZ"),
    ];
    const { result, rerender } = renderHook(
      ({ filterText }) => useTopicListSearch({ topics, datatypes: new Map(), filterText }),
      { initialProps: { filterText: "uniqueXYZ" } },
    );
    expect(result.current.map((row) => row.type === "topic" && row.item.item.channelId)).toEqual([
      "z",
      "z-uniqueXYZ",
    ]);
    // Matching a shared output schema retains both converted producers.
    rerender({ filterText: "Output" });
    expect(result.current.map((row) => row.type === "topic" && row.item.item.channelId)).toEqual([
      "z",
      "z-first",
      "z-uniqueXYZ",
    ]);
  });

  it("keeps converted fields beneath their producer and includes the source context", () => {
    const topics = [nativeTopic("z"), convertedTopic("z", "first")];
    const datatypes = new Map([["Output", { definitions: [{ name: "value", type: "int32" }] }]]);
    const { result } = renderHook(() =>
      useTopicListSearch({ topics, datatypes, filterText: "value" }),
    );
    expect(
      result.current.map((row) =>
        row.type === "topic" ? row.item.item.channelId : row.item.item.topic.channelId,
      ),
    ).toEqual(["z", "z-first", "z-first"]);
  });

  it("retains converted channels when their source is unavailable", () => {
    const topics = [convertedTopic("missing", "first")];
    const { result } = renderHook(() =>
      useTopicListSearch({ topics, datatypes: new Map(), filterText: "" }),
    );
    expect(result.current.map((row) => row.type === "topic" && row.item.item.channelId)).toEqual([
      "missing-first",
    ]);
  });

  it("retains every channel sharing a topic and keeps matching fields under their producer", () => {
    const topics = ["first", "second"].map((channelId) => ({
      name: "/shared",
      schemaName: "Message",
      channelId,
    }));
    const datatypes = new Map([["Message", { definitions: [{ name: "value", type: "int32" }] }]]);
    const { result, rerender } = renderHook(
      ({ filterText }) => useTopicListSearch({ topics, datatypes, filterText }),
      { initialProps: { filterText: "" } },
    );
    expect(
      result.current.map((row) => (row.type === "topic" ? row.item.item.channelId : undefined)),
    ).toEqual(["first", "second"]);
    rerender({ filterText: "value" });
    expect(
      result.current.map((row) =>
        row.type === "topic" ? row.item.item.channelId : row.item.item.topic.channelId,
      ),
    ).toEqual(["first", "first", "second", "second"]);
    rerender({ filterText: "second" });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.type === "topic" && result.current[0].item.item.channelId).toBe(
      "second",
    );
  });
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

  it("includes topic matches when there's a trailing dot", () => {
    const topics: UseTopicListSearchParams["topics"] = [
      { name: "abc", schemaName: "ABCD" },
      { name: "abc2", schemaName: "ABCD" },
      { name: "xyz", schemaName: "XYZW" },
    ];
    const datatypes: UseTopicListSearchParams["datatypes"] = new Map([
      ["ABCD", { definitions: [{ name: "xyz", type: "string" }] }],
      ["XYZW", { definitions: [{ name: "abcd", type: "string" }] }],
    ]);
    const { result } = renderHook(() =>
      useTopicListSearch({ topics, datatypes, filterText: "abc." }),
    );
    expect(result.current.map(itemToString)).toEqual(["abc", "abc.xyz", "abc2", "abc2.xyz"]);
  });
});
