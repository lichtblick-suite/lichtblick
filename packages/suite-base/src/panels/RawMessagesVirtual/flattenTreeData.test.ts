// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BasicBuilder } from "@lichtblick/test-builders";

import { flattenTreeData } from "./flattenTreeData";

describe("flattenTreeData", () => {
  let expandedNodes = new Set<string>();
  describe("when data is null or undefined", () => {
    it("should return empty array given undefined data", () => {
      // Given
      const data = undefined;

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });
  });

  describe("when data is a primitive type", () => {
    it("should return empty array given a string", () => {
      // Given
      const data = BasicBuilder.string();

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });

    it("should return empty array given a number", () => {
      // Given
      const data = BasicBuilder.number();

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });

    it("should return empty array given a boolean", () => {
      // Given
      const data = BasicBuilder.boolean();

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });
  });

  describe("when data is an ArrayBuffer view", () => {
    it("should return empty array given a Uint8Array", () => {
      // Given
      const data = new Uint8Array([1, 2, 3]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });

    it("should return empty array given a Float32Array", () => {
      // Given
      const data = new Float32Array([1.5, 2.5, 3.5]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });

    it("should return empty array given an Int16Array", () => {
      // Given
      const data = new Int16Array([10, 20, 30]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toEqual([]);
    });
  });

  describe("when data is a simple object", () => {
    it("should flatten object with primitive values", () => {
      // Given
      const data = {
        name: BasicBuilder.string(),
        age: BasicBuilder.number(),
        active: BasicBuilder.boolean(),
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        key: "name",
        label: "name",
        value: data.name,
        depth: 0,
        isExpandable: false,
        keyPath: ["name"],
        parentPath: "",
      });
      expect(result[1]).toEqual({
        key: "age",
        label: "age",
        value: data.age,
        depth: 0,
        isExpandable: false,
        keyPath: ["age"],
        parentPath: "",
      });
      expect(result[2]).toEqual({
        key: "active",
        label: "active",
        value: data.active,
        depth: 0,
        isExpandable: false,
        keyPath: ["active"],
        parentPath: "",
      });
    });

    it("should mark null values as not expandable", () => {
      // Given
      const data = {
        // eslint-disable-next-line no-restricted-syntax
        nullValue: null,
        undefinedValue: undefined,
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0]?.isExpandable).toBe(false);
      expect(result[1]?.isExpandable).toBe(false);
    });

    it("should mark ArrayBuffer views as not expandable", () => {
      // Given
      const data = {
        buffer: new Uint8Array([1, 2, 3]),
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]?.isExpandable).toBe(false);
    });

    it("should mark empty objects as not expandable", () => {
      // Given
      const data = {
        emptyObject: {},
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]?.isExpandable).toBe(false);
    });

    it("should mark empty arrays as not expandable", () => {
      // Given
      const data = {
        emptyArray: [],
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]?.isExpandable).toBe(false);
    });
  });

  describe("when data is a nested object", () => {
    it("should not expand children when parent is not in expandedNodes", () => {
      // Given
      const data = {
        user: {
          name: BasicBuilder.string(),
          age: BasicBuilder.number(),
        },
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        key: "user",
        label: "user",
        value: { name: data.user.name, age: data.user.age },
        depth: 0,
        isExpandable: true,
        keyPath: ["user"],
        parentPath: "",
      });
    });

    it("should expand children when parent is in expandedNodes", () => {
      // Given
      const data = {
        user: {
          name: BasicBuilder.string(),
          age: BasicBuilder.number(),
        },
      };
      expandedNodes = new Set<string>(["user"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0]?.key).toBe("user");
      expect(result[0]?.depth).toBe(0);
      expect(result[1]).toEqual({
        key: "name~user",
        label: "name",
        value: data.user.name,
        depth: 1,
        isExpandable: false,
        keyPath: ["name", "user"],
        parentPath: "user",
      });
      expect(result[2]).toEqual({
        key: "age~user",
        label: "age",
        value: data.user.age,
        depth: 1,
        isExpandable: false,
        keyPath: ["age", "user"],
        parentPath: "user",
      });
    });

    it("should handle deeply nested objects with multiple levels expanded", () => {
      // Given
      const data = {
        level1: {
          level2: {
            level3: {
              value: BasicBuilder.string(),
            },
          },
        },
      };
      expandedNodes = new Set<string>(["level1", "level2~level1", "level3~level2~level1"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(4);
      expect(result[0]?.key).toBe("level1");
      expect(result[0]?.depth).toBe(0);
      expect(result[1]?.key).toBe("level2~level1");
      expect(result[1]?.depth).toBe(1);
      expect(result[2]?.key).toBe("level3~level2~level1");
      expect(result[2]?.depth).toBe(2);
      expect(result[3]?.key).toBe("value~level3~level2~level1");
      expect(result[3]?.depth).toBe(3);
      expect(result[3]?.value).toBe(data.level1.level2.level3.value);
    });

    it("should stop expanding at unexpanded nodes in the middle of the tree", () => {
      // Given
      const data = {
        level1: {
          level2: {
            level3: {
              value: BasicBuilder.string(),
            },
          },
        },
      };
      expandedNodes = new Set<string>(["level1"]); // level2 is not expanded

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(2);
      expect(result[0]?.key).toBe("level1");
      expect(result[1]?.key).toBe("level2~level1");
      expect(result[1]?.isExpandable).toBe(true);
    });
  });

  describe("when data is an array", () => {
    it("should flatten array with primitive values", () => {
      // Given
      const data = [BasicBuilder.string(), BasicBuilder.string(), BasicBuilder.string()];

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        key: "0",
        label: "0",
        value: data[0],
        depth: 0,
        isExpandable: false,
        keyPath: [0],
        parentPath: "",
      });
      expect(result[1]).toEqual({
        key: "1",
        label: "1",
        value: data[1],
        depth: 0,
        isExpandable: false,
        keyPath: [1],
        parentPath: "",
      });
      expect(result[2]).toEqual({
        key: "2",
        label: "2",
        value: data[2],
        depth: 0,
        isExpandable: false,
        keyPath: [2],
        parentPath: "",
      });
    });

    it("should flatten array with object elements when expanded", () => {
      // Given
      const data = [
        { id: 1, name: BasicBuilder.string() },
        { id: 2, name: BasicBuilder.string() },
      ];
      expandedNodes = new Set<string>(["0", "1"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(6);
      expect(result[0]?.key).toBe("0");
      expect(result[0]?.isExpandable).toBe(true);
      expect(result[1]?.key).toBe("id~0");
      expect(result[1]?.parentPath).toBe("0");
      expect(result[2]?.key).toBe("name~0");
      expect(result[2]?.parentPath).toBe("0");
      expect(result[3]?.key).toBe("1");
      expect(result[3]?.isExpandable).toBe(true);
      expect(result[4]?.key).toBe("id~1");
      expect(result[4]?.parentPath).toBe("1");
      expect(result[5]?.key).toBe("name~1");
      expect(result[5]?.parentPath).toBe("1");
    });

    it("should handle nested arrays", () => {
      // Given
      const data = {
        matrix: [
          [1, 2],
          [3, 4],
        ],
      };
      expandedNodes = new Set<string>(["matrix", "0~matrix", "1~matrix"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result[0]?.key).toBe("matrix");
      expect(result[1]?.key).toBe("0~matrix");
      expect(result[1]?.isExpandable).toBe(true);
      expect(result[2]?.key).toBe("0~0~matrix");
      expect(result[2]?.value).toBe(1);
      expect(result[3]?.key).toBe("1~0~matrix");
      expect(result[3]?.value).toBe(2);
      expect(result[4]?.key).toBe("1~matrix");
      expect(result[4]?.isExpandable).toBe(true);
      expect(result[5]?.key).toBe("0~1~matrix");
      expect(result[5]?.value).toBe(3);
      expect(result[6]?.key).toBe("1~1~matrix");
      expect(result[6]?.value).toBe(4);
    });
  });

  describe("when handling keyPath", () => {
    it("should build correct keyPath for nested structures", () => {
      // Given
      const data = {
        outer: {
          middle: {
            inner: BasicBuilder.string(),
          },
        },
      };
      expandedNodes = new Set<string>(["outer", "middle~outer"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0]?.keyPath).toEqual(["outer"]);
      expect(result[1]?.keyPath).toEqual(["middle", "outer"]);
      expect(result[2]?.keyPath).toEqual(["inner", "middle", "outer"]);
    });

    it("should preserve keyPath with array indices", () => {
      // Given
      const data = {
        items: [{ name: BasicBuilder.string() }],
      };
      expandedNodes = new Set<string>(["items", "0~items"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result[0]?.keyPath).toEqual(["items"]);
      expect(result[1]?.keyPath).toEqual([0, "items"]);
      expect(result[2]?.keyPath).toEqual(["name", 0, "items"]);
    });
  });

  describe("when handling mixed data structures", () => {
    it("should handle objects containing arrays containing objects", () => {
      // Given
      const data = {
        users: [
          {
            name: BasicBuilder.string(),
            roles: [BasicBuilder.string(), BasicBuilder.string()],
          },
        ],
      };
      expandedNodes = new Set<string>(["users", "0~users", "roles~0~users"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result[0]?.key).toBe("users");
      expect(result[1]?.key).toBe("0~users");
      expect(result[2]?.key).toBe("name~0~users");
      expect(result[2]?.value).toBe(data.users[0]?.name);
      expect(result[3]?.key).toBe("roles~0~users");
      expect(result[3]?.isExpandable).toBe(true);
      expect(result[4]?.key).toBe("0~roles~0~users");
      expect(result[4]?.value).toBe(data.users[0]?.roles[0]);
      expect(result[5]?.key).toBe("1~roles~0~users");
      expect(result[5]?.value).toBe(data.users[0]?.roles[1]);
    });

    it("should handle complex real-world message structure", () => {
      // Given
      const data = {
        header: {
          stamp: { sec: BasicBuilder.number(), nsec: BasicBuilder.number() },
          frame_id: BasicBuilder.string(),
        },
        pose: {
          position: { x: BasicBuilder.float(), y: BasicBuilder.float(), z: BasicBuilder.float() },
        },
      };
      expandedNodes = new Set<string>(["header", "stamp~header", "pose", "position~pose"]);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result.find((node) => node.key === "header")).toBeTruthy();
      expect(result.find((node) => node.key === "stamp~header")).toBeTruthy();
      expect(result.find((node) => node.key === "sec~stamp~header")?.value).toBe(
        data.header.stamp.sec,
      );
      expect(result.find((node) => node.key === "nsec~stamp~header")?.value).toBe(
        data.header.stamp.nsec,
      );
      expect(result.find((node) => node.key === "frame_id~header")?.value).toBe(
        data.header.frame_id,
      );
      expect(result.find((node) => node.key === "pose")).toBeTruthy();
      expect(result.find((node) => node.key === "position~pose")).toBeTruthy();
      expect(result.find((node) => node.key === "x~position~pose")?.value).toBe(
        data.pose.position.x,
      );
      expect(result.find((node) => node.key === "y~position~pose")?.value).toBe(
        data.pose.position.y,
      );
      expect(result.find((node) => node.key === "z~position~pose")?.value).toBe(
        data.pose.position.z,
      );
    });
  });

  describe("when using custom parameters", () => {
    it("should respect custom parentPath parameter", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const parentPath = "custom~parent";

      // When
      const result = flattenTreeData(data, expandedNodes, parentPath);

      // Then
      expect(result[0]?.key).toBe("field~custom~parent");
      expect(result[0]?.parentPath).toBe("custom~parent");
    });

    it("should respect custom depth parameter", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const parentPath = "";
      const depth = BasicBuilder.number({ min: 1, max: 10 });

      // When
      const result = flattenTreeData(data, expandedNodes, parentPath, depth);

      // Then
      expect(result[0]?.depth).toBe(depth);
    });

    it("should respect custom keyPath parameter", () => {
      // Given
      const data = { field: BasicBuilder.string() };
      const parentPath = "";
      const depth = 0;
      const keyPath = [BasicBuilder.string(), BasicBuilder.string()];

      // When
      const result = flattenTreeData(data, expandedNodes, parentPath, depth, keyPath);

      // Then
      expect(result[0]?.keyPath).toEqual(["field", keyPath[0], keyPath[1]]);
    });

    it("should combine all custom parameters correctly", () => {
      // Given
      const data = { nested: { value: BasicBuilder.number() } };
      const parentPath = BasicBuilder.string();
      expandedNodes = new Set<string>([`nested~${parentPath}`]);

      const depth = BasicBuilder.number({ min: 1, max: 5 });
      const keyPath = ["root"];

      // When
      const result = flattenTreeData(data, expandedNodes, parentPath, depth, keyPath);

      // Then
      expect(result[0]?.key).toBe(`nested~${parentPath}`);
      expect(result[0]?.depth).toBe(depth);
      expect(result[0]?.keyPath).toEqual(["nested", "root"]);
      expect(result[0]?.parentPath).toBe(parentPath);
      expect(result[1]?.key).toBe(`value~nested~${parentPath}`);
      expect(result[1]?.depth).toBe(depth + 1);
      expect(result[1]?.keyPath).toEqual(["value", "nested", "root"]);
    });
  });

  describe("when handling edge cases", () => {
    it("should handle object with numeric string keys", () => {
      // Given
      const data = {
        "0": "zero",
        "1": "one",
        "10": "ten",
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0]?.key).toBe("0");
      expect(result[0]?.label).toBe("0");
      expect(result[1]?.key).toBe("1");
      expect(result[2]?.key).toBe("10");
    });

    it("should handle object with special characters in keys", () => {
      // Given
      const data = {
        "key-with-dash": "value1",
        "key.with.dot": "value2",
        "key with space": "value3",
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(3);
      expect(result.find((node) => node.key === "key-with-dash")).toBeTruthy();
      expect(result.find((node) => node.key === "key.with.dot")).toBeTruthy();
      expect(result.find((node) => node.key === "key with space")).toBeTruthy();
    });

    it("should handle object with symbol keys (symbols are not enumerated)", () => {
      // Given
      const symbolKey = Symbol(BasicBuilder.string());
      const data = {
        normalKey: BasicBuilder.string(),
        [symbolKey]: BasicBuilder.string(),
      };

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      // Symbols are not included in Object.entries()
      expect(result).toHaveLength(1);
      expect(result[0]?.key).toBe("normalKey");
    });

    it("should handle very large arrays efficiently", () => {
      // Given
      const data = Array.from({ length: 1000 }, (_, i) => i);

      // When
      const result = flattenTreeData(data, expandedNodes);

      // Then
      expect(result).toHaveLength(1000);
      expect(result[0]?.value).toBe(0);
      expect(result[999]?.value).toBe(999);
    });
  });
});
