// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePathDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { NodeExpansion, NodeState } from "@lichtblick/suite-base/panels/RawMessages/types";
import {
  getConstantNameFromQueriedData,
  getMessageDocumentationLink,
  toggleExpansion,
} from "@lichtblick/suite-base/panels/RawMessages/utils";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

describe("getMessageDocumentationLink", () => {
  it("links to ROS and Foxglove docs", () => {
    expect(getMessageDocumentationLink("std_msgs/String")).toEqual(
      "https://docs.ros.org/api/std_msgs/html/msg/String.html",
    );
    expect(getMessageDocumentationLink("foxglove_msgs/CircleAnnotation")).toEqual(
      "https://docs.foxglove.dev/docs/visualization/message-schemas/circle-annotation",
    );
    expect(getMessageDocumentationLink("foxglove_msgs/msg/CircleAnnotation")).toEqual(
      "https://docs.foxglove.dev/docs/visualization/message-schemas/circle-annotation",
    );
    expect(getMessageDocumentationLink("foxglove.CircleAnnotation")).toEqual(
      "https://docs.foxglove.dev/docs/visualization/message-schemas/circle-annotation",
    );
    expect(getMessageDocumentationLink("foxglove.DoesNotExist")).toBeUndefined();
  });
});

describe("toggleExpansion", () => {
  const PATH_NAME_AGGREGATOR = "~";

  it("should keep all states expanded when state is 'all' except for the state of the key passed, changes it to collapsed", () => {
    const paths = new Set(["key1", "key2", `child${PATH_NAME_AGGREGATOR}key1`]);
    const result = toggleExpansion("all", paths, "key1");

    expect(result).toEqual({
      key1: NodeState.Collapsed,
      key2: NodeState.Expanded,
      [`child${PATH_NAME_AGGREGATOR}key1`]: NodeState.Expanded,
    });
  });

  it("should keep all states collapsed when state is 'none' except for the state of the key passed, changes it to expanded", () => {
    const paths = new Set(["key1", "key2", `child${PATH_NAME_AGGREGATOR}key1`]);
    const result = toggleExpansion("none", paths, "key1");

    expect(result).toEqual({
      key1: NodeState.Expanded,
      key2: NodeState.Collapsed,
      [`child${PATH_NAME_AGGREGATOR}key1`]: NodeState.Collapsed,
    });
  });

  it("should toggle an individual path without affecting others (children or not)", () => {
    const paths = new Set(["key1", "key1~child", "key1~child~grandchild"]);
    const initialState: NodeExpansion = {
      key1: NodeState.Expanded,
      [`child${PATH_NAME_AGGREGATOR}key1`]: NodeState.Expanded,
      [`grandchild${PATH_NAME_AGGREGATOR}child${PATH_NAME_AGGREGATOR}key1`]: NodeState.Expanded,
      key2: NodeState.Collapsed,
    };

    const result = toggleExpansion(initialState, paths, "key1");

    expect(result).toEqual({
      key1: NodeState.Collapsed,
      [`child${PATH_NAME_AGGREGATOR}key1`]: NodeState.Expanded,
      [`grandchild${PATH_NAME_AGGREGATOR}child${PATH_NAME_AGGREGATOR}key1`]: NodeState.Expanded,
      key2: NodeState.Collapsed,
    });
  });
});

describe("getConstantNameFromQueriedData", () => {
  it("returns undefined if label is not a number", () => {
    const label = BasicBuilder.string();
    const queriedData: MessagePathDataItem[] = [];

    const result = getConstantNameFromQueriedData(label, queriedData);

    expect(result).toBeUndefined();
  });

  it("returns undefined if queriedData at position does not exist", () => {
    const label = BasicBuilder.number();
    const queriedData: MessagePathDataItem[] = [];

    const result = getConstantNameFromQueriedData(label, queriedData);

    expect(result).toBeUndefined();
  });

  it("returns constantName correctly when present", () => {
    const queriedData: MessagePathDataItem[] = [
      {
        constantName: BasicBuilder.string(),
        path: BasicBuilder.string(),
        value: BasicBuilder.number(),
      },
    ];
    const label = queriedData.length - 1;

    const result = getConstantNameFromQueriedData(label, queriedData);

    expect(result).toBe(queriedData[label]?.constantName);
  });

  it("returns undefined if constantName is missing from item", () => {
    const label = 0;
    const queriedData: MessagePathDataItem[] = [
      {
        path: "foo.bar",
        value: 42,
      },
    ];

    const result = getConstantNameFromQueriedData(label, queriedData);

    expect(result).toBeUndefined();
  });
});
