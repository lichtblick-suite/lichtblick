// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessagePathDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { NodeExpansion, NodeState } from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import {
  dataWithoutWrappingArray,
  getConstantNameByKeyPath,
  getCopyAction,
  getFilterAction,
  getLineChartAction,
  getMessageDocumentationLink,
  getScatterPlotAction,
  getSingleValue,
  getStateTransitionsAction,
  getValueLabels,
  getValueString,
  isSingleElemArray,
  toggleExpansion,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/utils";
import { BasicBuilder } from "@lichtblick/test-builders";

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

  describe("isSingleElemArray", () => {
    it("should return false for non-array values", () => {
      expect(isSingleElemArray("string")).toBe(false);
      expect(isSingleElemArray(123)).toBe(false);
      expect(isSingleElemArray({})).toBe(false);
      expect(isSingleElemArray(undefined)).toBe(false);
    });

    it("should return false for empty arrays", () => {
      expect(isSingleElemArray([])).toBe(false);
    });

    it("should return false for arrays with multiple elements", () => {
      expect(isSingleElemArray([1, 2, 3])).toBe(false);
      expect(isSingleElemArray(["a", "b"])).toBe(false);
    });

    it("should return true for arrays with single element", () => {
      expect(isSingleElemArray([1])).toBe(true);
      expect(isSingleElemArray(["string"])).toBe(true);
      expect(isSingleElemArray([{}])).toBe(true);
    });

    it("should ignore undefined elements when counting", () => {
      expect(isSingleElemArray([1, undefined])).toBe(true);
      expect(isSingleElemArray([undefined, 1])).toBe(true);
      expect(isSingleElemArray([1, undefined, undefined])).toBe(true);
    });

    it("should return false when array has multiple non-undefined elements", () => {
      expect(isSingleElemArray([1, undefined, 2])).toBe(false);
      expect(isSingleElemArray([1, 2, undefined])).toBe(false);
    });

    it("should return false for arrays with only undefined elements", () => {
      expect(isSingleElemArray([undefined])).toBe(false);
      expect(isSingleElemArray([undefined, undefined])).toBe(false);
    });
  });

  describe("dataWithoutWrappingArray", () => {
    it("should return data as-is if not a single element array", () => {
      // Given
      const data = BasicBuilder.string();

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toBe(data);
    });

    it("should return data as-is for multiple element arrays", () => {
      // Given
      const data = BasicBuilder.numbers();

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toEqual(data);
    });

    it("should return data as-is for single element arrays with non-object values", () => {
      // Given
      const data = [BasicBuilder.number()];

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toEqual(data);
    });

    it("should unwrap single element array containing an object", () => {
      // Given
      const obj = { name: BasicBuilder.string(), value: BasicBuilder.number() };
      const data = [obj];

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toBe(obj);
    });

    it("should unwrap single element array containing an array", () => {
      // Given
      const innerArray = BasicBuilder.numbers();
      const data = [innerArray];

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toBe(innerArray);
    });

    it("should return array as-is for single element with string value", () => {
      // Given
      const data = [BasicBuilder.string()];

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toEqual(data);
    });

    it("should unwrap array with multiple undefined and single object", () => {
      // Given
      const obj = { x: BasicBuilder.number() };
      const data = [obj, undefined, undefined];

      // When
      const result = dataWithoutWrappingArray(data);

      // Then
      expect(result).toBe(obj);
    });
  });

  describe("getSingleValue", () => {
    it("should return data as-is if not a single element array", () => {
      // Given
      const data = BasicBuilder.string();
      const queriedData: MessagePathDataItem[] = [];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(data);
    });

    it("should return data as-is for multiple element arrays", () => {
      // Given
      const data = BasicBuilder.numbers();
      const queriedData: MessagePathDataItem[] = [];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toEqual(data);
    });

    it("should return first element from single element array when no constantName", () => {
      // Given
      const arrayItem = BasicBuilder.number();
      const data = [arrayItem];
      const queriedData: MessagePathDataItem[] = [
        {
          path: BasicBuilder.string(),
          value: arrayItem,
        },
      ];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(arrayItem);
    });

    it("should append constantName to first element from single element array", () => {
      // Given
      const arrayItem = BasicBuilder.number();
      const constName = BasicBuilder.string();
      const data = [arrayItem];
      const queriedData: MessagePathDataItem[] = [
        {
          constantName: constName,
          path: BasicBuilder.string(),
          value: arrayItem,
        },
      ];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(`${arrayItem} (${constName})`);
    });

    it("should return first element when constantName is undefined", () => {
      // Given
      const elementValue = BasicBuilder.string();
      const data = [elementValue];
      const queriedData: MessagePathDataItem[] = [
        {
          path: BasicBuilder.string(),
          value: elementValue,
          constantName: undefined,
        },
      ];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(elementValue);
    });

    it("should return data as-is when queriedData is empty", () => {
      // Given
      const arrayItem = BasicBuilder.number();
      const data = [arrayItem];
      const queriedData: MessagePathDataItem[] = [];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(arrayItem);
    });

    it("should handle single element array with BigInt and constantName", () => {
      // Given
      const value = BasicBuilder.bigInt();
      const data = [value];
      const queriedData: MessagePathDataItem[] = [
        {
          constantName: "BIG_NUMBER",
          path: BasicBuilder.string(),
          value,
        },
      ];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(`${value} (BIG_NUMBER)`);
    });

    it("should handle single element array with undefined elements and constantName", () => {
      // Given
      const arrayItem = BasicBuilder.number();
      const data = [arrayItem, undefined, undefined];
      const queriedData: MessagePathDataItem[] = [
        {
          constantName: "FILTERED_VALUE",
          path: BasicBuilder.string(),
          value: arrayItem,
        },
      ];

      // When
      const result = getSingleValue(data, queriedData);

      // Then
      expect(result).toBe(`${arrayItem} (FILTERED_VALUE)`);
    });
  });

  describe("getValueLabels", () => {
    describe("when handling bigint values", () => {
      it("should convert bigint to string as itemLabel", () => {
        // Given
        const value = BasicBuilder.bigInt();
        const props = {
          constantName: undefined,
          label: BasicBuilder.string(),
          itemValue: value,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe(`${value}`);
        expect(result.arrLabel).toBe("");
      });
    });

    describe("when handling typed arrays", () => {
      it("should preview Uint8Array with length and first items", () => {
        // Given
        const arrayLength = BasicBuilder.number();
        const arrayItems = BasicBuilder.number();
        const array = new Uint8Array(arrayLength);
        array.fill(arrayItems);
        const props = {
          constantName: undefined,
          label: "data",
          itemValue: array,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("Uint8Array");
        expect(result.arrLabel).toContain(`${arrayLength}`);
        expect(result.arrLabel).toContain(`${arrayItems}`);
      });

      it("should show ellipsis when array exceeds preview limit", () => {
        // Given
        const array = new Uint8Array(1000);
        array.fill(42);
        const props = {
          constantName: undefined,
          label: "largeData",
          itemValue: array,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("Uint8Array");
        expect(result.arrLabel).toContain("(1000)");
        expect(result.arrLabel).toContain("…");
      });

      it("should handle Int32Array typed array", () => {
        // Given
        const array = new Int32Array([1, 2, 3, 4, 5]);
        const props = {
          constantName: undefined,
          label: "integers",
          itemValue: array,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("Int32Array");
        expect(result.arrLabel).toContain("(5)");
        expect(result.arrLabel).toContain("1, 2, 3, 4, 5");
      });

      it("should not treat DataView as typed array", () => {
        // Given
        const buffer = new ArrayBuffer(8);
        const dataView = new DataView(buffer);
        const props = {
          constantName: undefined,
          label: "view",
          itemValue: dataView,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("view");
        expect(result.arrLabel).toBe("");
      });
    });

    describe("when handling constant names", () => {
      it("should append constant name to itemLabel", () => {
        // Given
        const props = {
          constantName: "MY_CONSTANT",
          label: "status",
          itemValue: 5,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("status (MY_CONSTANT)");
      });

      it("should not append constant name when undefined", () => {
        // Given
        const props = {
          constantName: undefined,
          label: "value",
          itemValue: 10,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("value");
      });

      it("should append constant name to bigint converted label", () => {
        // Given
        const value = BasicBuilder.bigInt();
        const props = {
          constantName: "ENUM_VALUE",
          label: "shouldBeIgnored",
          itemValue: value,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe(`${value} (ENUM_VALUE)`);
      });
    });

    describe("when handling nanosecond fields", () => {
      it("should pad nsec field to 9 digits", () => {
        // Given
        const props = {
          constantName: undefined,
          label: "99999999",
          itemValue: 99999999,
          keyPath: ["nsec"],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("099999999");
      });

      it("should pad nsec with leading zeros for single digit", () => {
        // Given
        const props = {
          constantName: undefined,
          label: "5",
          itemValue: 5,
          keyPath: ["nsec"],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("000000005");
      });

      it("should not pad if keyPath does not start with nsec", () => {
        // Given
        const props = {
          constantName: undefined,
          label: "50",
          itemValue: 50,
          keyPath: ["sec"],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("50");
      });

      it("should not pad nsec if itemValue is not a number", () => {
        // Given
        const props = {
          constantName: undefined,
          label: "stringValue",
          itemValue: "123",
          keyPath: ["nsec"],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("stringValue");
      });

      it("should not pad nsec if itemLabel is not a string", () => {
        // Given
        const props = {
          constantName: undefined,
          label: 123 as unknown as string,
          itemValue: 999999,
          keyPath: ["nsec"],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe(123);
      });
    });

    describe("complex combinations", () => {
      it("should handle typed array with constant name", () => {
        // Given
        const array = new Uint8Array([1, 2, 3]);
        const props = {
          constantName: "BINARY_DATA",
          label: "payload",
          itemValue: array,
          keyPath: [],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe("Uint8Array (BINARY_DATA)");
        expect(result.arrLabel).toContain("(3)");
      });

      it("should handle bigint with constant name and nsec padding", () => {
        // Given
        const value = BasicBuilder.bigInt();
        const props = {
          constantName: "TIME_CONSTANT",
          label: "shouldBeIgnored",
          itemValue: value,
          keyPath: ["nsec"],
        };

        // When
        const result = getValueLabels(props);

        // Then
        expect(result.itemLabel).toBe(`${value} (TIME_CONSTANT)`);
      });
    });
  });
});

describe("getCopyAction", () => {
  describe("given a value and copy handler", () => {
    const itemValue = { foo: BasicBuilder.string(), num: BasicBuilder.number() };
    const handleCopy = jest.fn();
    describe("when copied is false", () => {
      const resultFalse = getCopyAction({ copied: false }, itemValue, handleCopy);
      it("then should return copy action with CopyAllIcon", () => {
        // Then
        expect(resultFalse.key).toBe("Copy");
        expect(resultFalse.activeColor).toBe("primary");
        expect(resultFalse.tooltip).toBe("Copy to Clipboard");
        expect(resultFalse.icon).toBeDefined();
      });

      it("then should call handleCopy with stringified JSON when clicked", () => {
        // When
        resultFalse.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

        // Then
        expect(handleCopy).toHaveBeenCalledWith(
          JSON.stringify(
            itemValue,
            expect.any(Function) as (key: string, value: unknown) => unknown,
            2,
          ),
        );
      });
    });

    describe("when copied is true", () => {
      const resultTrue = getCopyAction({ copied: true }, itemValue, handleCopy);
      it("then should return success action with CheckIcon", () => {
        // Then
        expect(resultTrue.key).toBe("Copy");
        expect(resultTrue.activeColor).toBe("success");
        expect(resultTrue.tooltip).toBe("Copied");
        expect(resultTrue.icon).toBeDefined();
      });
    });
  });
});

describe("getFilterAction", () => {
  describe("given a filter handler", () => {
    const onFilter = jest.fn();
    describe("when creating filter action", () => {
      const result = getFilterAction(onFilter);
      it("then should return filter action with correct properties", () => {
        // Then
        expect(result.key).toBe("Filter");
        expect(result.tooltip).toBe("Filter on this value");
        expect(result.icon).toBeDefined();
      });

      it("then should call onFilter when clicked", () => {
        // When
        result.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

        // Then
        expect(onFilter).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe("getLineChartAction", () => {
  describe("given a single slice path and plot panel opener", () => {
    const singleSlicePath = BasicBuilder.string("/topic.field");
    const mockHandler = jest.fn();
    const openPlotPanel = jest.fn(() => mockHandler);
    describe("when creating line chart action", () => {
      const result = getLineChartAction(singleSlicePath, openPlotPanel);
      it("then should return line chart action with correct properties", () => {
        // Then
        expect(result.key).toBe("line");
        expect(result.tooltip).toBe("Plot this value on a line chart");
        expect(result.icon).toBeDefined();
      });

      it("then should call openPlotPanel with path when clicked", () => {
        // When
        result.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

        // Then
        expect(openPlotPanel).toHaveBeenCalledWith(singleSlicePath);
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe("getScatterPlotAction", () => {
  describe("given a multi slice path and plot panel opener", () => {
    const multiSlicePath = BasicBuilder.string("/topic.array[:]");
    const mockHandler = jest.fn();
    const openPlotPanel = jest.fn(() => mockHandler);
    describe("when creating scatter plot action", () => {
      const result = getScatterPlotAction(multiSlicePath, openPlotPanel);
      it("then should return scatter plot action with correct properties", () => {
        // Then
        expect(result.key).toBe("scatter");
        expect(result.tooltip).toBe("Plot this value on a scatter plot");
        expect(result.icon).toBeDefined();
      });

      it("then should call openPlotPanel with path when clicked", () => {
        // When
        result.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

        // Then
        expect(openPlotPanel).toHaveBeenCalledWith(multiSlicePath);
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe("getStateTransitionsAction", () => {
  describe("given a single slice path and state transitions panel opener", () => {
    const singleSlicePath = BasicBuilder.string("/topic.state");
    const mockHandler = jest.fn();
    const openStateTransitionsPanel = jest.fn(() => mockHandler);
    describe("when creating state transitions action", () => {
      const result = getStateTransitionsAction(singleSlicePath, openStateTransitionsPanel);
      it("then should return state transitions action with correct properties", () => {
        // Then
        expect(result.key).toBe("stateTransitions");
        expect(result.tooltip).toBe("View state transitions for this value");
        expect(result.icon).toBeDefined();
      });

      it("then should call openStateTransitionsPanel with path when clicked", () => {
        result.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

        // Then
        expect(openStateTransitionsPanel).toHaveBeenCalledWith(singleSlicePath);
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });
    });
  });
});
