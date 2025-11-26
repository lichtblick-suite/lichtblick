// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePathDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { NodeExpansion, NodeState } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import {
  getConstantNameByKeyPath,
  getMessageDocumentationLink,
  getValueString,
  toggleExpansion,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";
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

describe("getConstantNameByKeyPath", () => {
  it("should return undefined when keyPath is empty", () => {
    const keyPath: (string | number)[] = [];
    const queriedData: MessagePathDataItem[] = [];

    const result = getConstantNameByKeyPath(keyPath, queriedData);

    expect(result).toBeUndefined();
  });

  it("should return undefined when keyPath is not a number", () => {
    const keyPath: (string | number)[] = [BasicBuilder.string()];
    const queriedData: MessagePathDataItem[] = [];

    const result = getConstantNameByKeyPath(keyPath, queriedData);

    expect(result).toBeUndefined();
  });

  it("should return undefined when queriedData at keyPath does not exist", () => {
    const keyPath: (string | number)[] = [BasicBuilder.number()];
    const queriedData: MessagePathDataItem[] = [];

    const result = getConstantNameByKeyPath(keyPath, queriedData);

    expect(result).toBeUndefined();
  });

  it("should return undefined if constantName is missing from item", () => {
    const keyPath: (string | number)[] = [0];
    const queriedData: MessagePathDataItem[] = [
      {
        path: BasicBuilder.string(),
        value: BasicBuilder.number(),
      },
    ];

    const result = getConstantNameByKeyPath(keyPath, queriedData);

    expect(result).toBeUndefined();
  });

  it("should return constantName correctly when present", () => {
    const constantName = BasicBuilder.string();
    const queriedData: MessagePathDataItem[] = [
      {
        constantName,
        path: BasicBuilder.string(),
        value: BasicBuilder.number(),
      },
    ];
    const keyPath: (string | number)[] = [0];

    const result = getConstantNameByKeyPath(keyPath, queriedData);

    expect(result).toBe(constantName);
  });
});

describe("getValueString", () => {
  describe("when handling null and undefined values", () => {
    it("should return 'undefined' for undefined values", () => {
      // Given
      const value = undefined;

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("undefined");
    });

    it("should return 'null' for null values", () => {
      // Given
      // eslint-disable-next-line no-restricted-syntax
      const value = null;

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("null");
    });
  });

  describe("when handling string values", () => {
    it("should wrap string values in double quotes", () => {
      // Given
      const value = BasicBuilder.string();

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe(`"${value}"`);
    });

    it("should handle empty strings correctly", () => {
      // Given
      const value = "";

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe('""');
    });

    it("should handle strings with special characters", () => {
      // Given
      const value = 'test "quoted" string';

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe('"test "quoted" string"');
    });
  });

  describe("when handling bigint values", () => {
    it("should convert bigint to string", () => {
      // Given
      const value = BigInt(9007199254740991);

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("9007199254740991");
    });
  });

  describe("when handling boolean values", () => {
    it("should convert true to 'true'", () => {
      // Given
      const value = true;

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("true");
    });

    it("should convert false to 'false'", () => {
      // Given
      const value = false;

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("false");
    });
  });

  describe("when handling number values", () => {
    it("should convert positive integers to string", () => {
      // Given
      const value = BasicBuilder.number();

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe(String(value));
    });

    it("should convert negative numbers to string", () => {
      // Given
      const value = -42.5;

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("-42.5");
    });

    it("should handle zero correctly", () => {
      // Given
      const value = 0;

      // When
      const result = getValueString(value);

      // Then
      expect(result).toBe("0");
    });
  });
});
