// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageEvent } from "@lichtblick/suite";
import { MessageAndData } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";
import { BasicBuilder } from "@lichtblick/test-builders";

import {
  extractQueriedData,
  isValidValue,
  getColor,
  createLabel,
  baseColors,
  messagesToDataset,
} from "./messagesToDataset";
import { MessageDatasetArgs, StateTransitionPath } from "./types";

const messageEvent = MessageEventBuilder.messageEvent({
  topic: "/test/message_topic_test",
  schemaName: "Unit.test.SchemaName",
  message: {
    test_property1: false,
    test_property2: undefined,
    test_property3: false,
    test_property4: undefined,
    test_property5: false,
    test_property6: undefined,
    test_property7: false,
    test_property8: undefined,
    test_property9: false,
    test_property0: 0,
    test_property11: false,
  },
});

const path: StateTransitionPath = {
  label: "Test Label",
  value: "/test/debug/unitTest.",
  timestampMethod: BasicBuilder.sample(["receiveTime", "headerStamp"] as TimestampMethod[]),
};

function MessageAndDataBuilder(
  messageEventInput: MessageEvent,
  value: number,
  pathInput: string,
  constantName: string,
): MessageAndData {
  return {
    messageEvent: messageEventInput,
    queriedData: [{ value, path: pathInput, constantName }],
  };
}

const item: MessageAndData = {
  messageEvent,
  queriedData: [{ value: BasicBuilder.number(), path: BasicBuilder.string() }],
};

let queriedDataValue: number;
let queriedDataName: string;
let queriedDataPath: string;
let constName: string | undefined;

describe("messagesToDataset helper functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    constName = BasicBuilder.string();
  });

  // unit tests for extractQueriedData

  it("should return the first item when queriedData has exactly one item", () => {
    const result = extractQueriedData(item);

    expect(result).toEqual(item.queriedData[0]);
  });

  it("should return undefined when queriedData's argument has an empty array", () => {
    const messageAndDataWithEmptyQueriedData: MessageAndData = {
      messageEvent,
      queriedData: [],
    };

    const result = extractQueriedData(messageAndDataWithEmptyQueriedData);

    expect(result).toEqual(undefined);
  });

  it("should return undefined when queriedData's argument has more than one item", () => {
    queriedDataValue = BasicBuilder.number();
    queriedDataPath = BasicBuilder.string();
    const messageAndDataWithMultipleItemsOnQueriedData: MessageAndData = {
      messageEvent,
      queriedData: [
        { value: queriedDataValue, path: queriedDataPath },
        { value: queriedDataValue, path: queriedDataPath },
      ],
    };
    const result = extractQueriedData(messageAndDataWithMultipleItemsOnQueriedData);

    expect(result).toEqual(undefined);
  });

  // unit tests for isValidValue
  it("should return false for object, not a valid value", () => {
    const value = {};
    expect(isValidValue(value)).toBe(false);
  });

  it("should return true for number", () => {
    const value = BasicBuilder.number();
    expect(isValidValue(value)).toBe(true);
  });

  it("should return true for string", () => {
    const value = BasicBuilder.string();
    expect(isValidValue(value)).toBe(true);
  });

  it("should return true for bigInt", () => {
    const value = BasicBuilder.bigInt();
    expect(isValidValue(value)).toBe(true);
  });

  it("should return true for boolean", () => {
    const value = BasicBuilder.boolean();
    expect(isValidValue(value)).toBe(true);
  });

  it("should return false for undefined, not a valid value", () => {
    const value = undefined;
    expect(isValidValue(value)).toBe(false);
  });

  it("should return false for NaN, not a valid value", () => {
    const value = NaN;
    expect(isValidValue(value)).toBe(false);
  });

  it("should return false for an object, not a valid value", () => {
    const value = {};
    expect(isValidValue(value)).toBe(false);
  });

  // unit tests for getColorForValue

  it("should return a color for a string input", () => {
    const value = BasicBuilder.string();
    const result = getColor(value);

    expect(baseColors).toContain(result);
  });

  it("should return a color for a number input", () => {
    const value = BasicBuilder.number();
    const result = getColor(value);

    expect(baseColors).toContain(result);
  });

  it("should return a color for a boolean input", () => {
    const value = BasicBuilder.boolean();
    const result = getColor(value);

    expect(baseColors).toContain(result);
  });

  it("should return a color for a bigInt input", () => {
    const value = BasicBuilder.bigInt();
    const result = getColor(value);

    expect(baseColors).toContain(result);
  });

  // unit tests for createLabel

  it("should return the label with constant name and value when constantName is string type", () => {
    const value = BasicBuilder.number();
    const result = createLabel(constName, value);

    expect(result).toBe(`${constName} (${String(value)})`);
  });

  it("should return the label only with value when constantName is undefined", () => {
    constName = undefined;
    const value = BasicBuilder.number();
    const result = createLabel(constName, value);

    expect(result).toBe(String(value));
  });

  it("should return the label with constant name and value when constantName is boolean type", () => {
    const value = BasicBuilder.boolean();
    const result = createLabel(constName, value);

    expect(result).toBe(`${constName} (${String(value)})`);
  });

  it("should return the label with constant name and value when constantName is number type", () => {
    const value = BasicBuilder.number();
    const result = createLabel(constName, value);

    expect(result).toBe(`${constName} (${String(value)})`);
  });

  it("should return the label with constant name and value when constantName is bigInt type", () => {
    const value = BasicBuilder.bigInt();
    const result = createLabel(constName, value);

    expect(result).toBe(`${constName} (${String(value)})`);
  });
});

describe("messagesToDataset", () => {
  const args = {
    path,
    startTime: RosTimeBuilder.time(),
    y: BasicBuilder.number(),
    pathIndex: BasicBuilder.number(),
    blocks: [],
    showPoints: false,
    timestampMethod: path,
  };

  beforeEach(() => {
    queriedDataValue = BasicBuilder.number();
    queriedDataName = BasicBuilder.string();
    queriedDataPath = BasicBuilder.string();
  });

  it("should initialize dataset with default properties", () => {
    const result = messagesToDataset(args);

    expect(result).toEqual(
      expect.objectContaining({
        borderWidth: 10,
        data: [],
        label: args.path.label,
        pointBackgroundColor: "rgba(0, 0, 0, 0.4)",
        pointBorderColor: "transparent",
        pointHoverRadius: 3,
        pointRadius: 0,
        pointStyle: "circle",
        showLine: true,
      }),
    );
  });

  it("should return an empty data array if blocks are empty", () => {
    const result = messagesToDataset({ ...args, blocks: [] });
    expect(result.data).toEqual([]);
  });

  it("should add data points when blocks contain valid messages", () => {
    //forcing path.timestampMethod to be receiveTime for this specific unit test, headerStamp wont work here
    const blocks: MessageAndData[][] = [
      [MessageAndDataBuilder(messageEvent, queriedDataValue, queriedDataPath, queriedDataName)],
    ];
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "receiveTime" },
      blocks,
    };

    const result = messagesToDataset(argsDataset);

    expect(result.data[0]).toStrictEqual({
      x: expect.any(Number),
      y: args.y,
      label: `${queriedDataName} (${queriedDataValue})`,
      labelColor: expect.any(String),
      value: queriedDataValue,
      constantName: queriedDataName,
    });
  });

  it("should return undefined because getTimestampForMessageEvent will return undefined", () => {
    //forcing path.timestampMethod to be headerStamp without headers in the message
    //so getTimestampForMessageEvent returns undefined
    const blocks: MessageAndData[][] = [
      [
        MessageAndDataBuilder(
          { ...messageEvent, message: { header: undefined } },
          queriedDataValue,
          queriedDataPath,
          queriedDataName,
        ),
      ],
    ];
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "headerStamp" },
      blocks,
    };

    const result = messagesToDataset(argsDataset);

    expect(result.data.length).toBe(0);
  });

  it("should return dataset with 1 item on data[] because getTimestampForMessageEvent is called with headerStamp with header", () => {
    //forcing path.timestampMethod to be headerStamp with header in the message
    //so getTimestampForMessageEvent returns a stamp and therefore a item is added to data[] inisde the ChartDataset object returned
    const blocks: MessageAndData[][] = [
      [
        MessageAndDataBuilder(
          { ...messageEvent, message: { header: { stamp: RosTimeBuilder.time() } } },
          queriedDataValue,
          queriedDataPath,
          queriedDataName,
        ),
      ],
    ];
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "headerStamp", label: undefined },
      blocks,
    };

    const result = messagesToDataset(argsDataset);

    expect(result.data.length).toBe(1);
    expect(result.label).toBe(args.path.value);
  });

  it("should return dataset with no data since blocks doesn't have any message", () => {
    //forcing path.timestampMethod to be receiveTime for this specific unit test, headerStamp wont work here
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "receiveTime" },
      blocks: [],
    };

    const result = messagesToDataset(argsDataset);
    expect(result.data.length).toBe(0);
  });

  it("should return dataset with no data since queriedData is empty and therefore extractQueriedData will return undefined", () => {
    const blocks: MessageAndData[][] = [
      [
        {
          messageEvent,
          queriedData: [],
        },
      ],
    ];
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "receiveTime" },
      blocks,
    };

    const result = messagesToDataset(argsDataset);

    expect(result.data.length).toBe(0);
  });

  it("should return dataset with no data since queriedData has more than one item and therefore extractQueriedData will return undefined", () => {
    const blocks: MessageAndData[][] = [
      [
        {
          messageEvent,
          queriedData: [
            { value: queriedDataValue, path: queriedDataPath },
            { value: queriedDataValue, path: queriedDataPath },
          ],
        },
      ],
    ];
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "receiveTime" },
      blocks,
    };

    const result = messagesToDataset(argsDataset);

    expect(result.data.length).toBe(0);
  });

  it("should return dataset with no data since queriedData.value is typeof NaN", () => {
    const blocks: MessageAndData[][] = [
      [
        {
          messageEvent,
          queriedData: [{ value: NaN, path: queriedDataPath }],
        },
      ],
    ];
    const argsDataset: MessageDatasetArgs = {
      ...args,
      path: { ...args.path, timestampMethod: "receiveTime" },
      blocks,
    };

    const result = messagesToDataset(argsDataset);

    expect(result.data.length).toBe(0);
  });

  it("should not assign a label to repeated consecutive data points", () => {
    const messageAndData = {
      messageEvent,
      queriedData: [{ value: queriedDataValue, path: queriedDataPath }],
    };

    const blocks: MessageAndData[][] = [[messageAndData, messageAndData]];

    const result = messagesToDataset({
      ...args,
      blocks,
      path: { ...args.path, timestampMethod: "receiveTime" },
    });

    expect(result.data[1]?.label).toBeUndefined();
  });

  it("should push lastDatum to dataset.data if isNewSegment is true but showPoints false and result.pointRadius to be 0", () => {
    const blocks = [
      undefined,
      [
        {
          messageEvent,
          queriedData: [{ value: queriedDataValue, path: queriedDataPath }],
        },
      ],
    ];

    const result = messagesToDataset({
      ...args,
      blocks,
      path: { ...args.path, timestampMethod: "receiveTime" },
    });

    expect(result.data.length).toBe(1);
    expect(result.data[0]).toEqual(expect.objectContaining({ value: queriedDataValue }));
    expect(result.pointRadius).toBe(0);
  });

  it("should push lastDatum to dataset.data if isNewSegment is false but showPoints true meaning the label on the second object on result.data is undefined", () => {
    const blocks = [
      [
        {
          messageEvent,
          queriedData: [{ value: queriedDataValue, path: queriedDataPath }],
        },
      ],
    ];

    const result = messagesToDataset({
      ...args,
      blocks,
      path: { ...args.path, timestampMethod: "receiveTime" },
      showPoints: true,
    });

    expect(result.data[1]?.label).toBe(undefined);
  });

  it("should keep lastDatum undefined", () => {
    const blocks = [
      [
        {
          messageEvent,
          queriedData: [{ value: undefined, path: queriedDataPath }],
        },
      ],
    ];

    const result = messagesToDataset({
      ...args,
      blocks,
      path: { ...args.path, timestampMethod: "receiveTime" },
    });

    expect(result.data.length).toBe(0);
  });

  it("should only add the first and last messages to result.data with showPoints is false", () => {
    const messageAndData = {
      messageEvent,
      queriedData: [{ value: queriedDataValue, path: queriedDataPath }],
    };

    const blocks = [[messageAndData, messageAndData, messageAndData, messageAndData]];

    const result = messagesToDataset({
      ...args,
      blocks,
      path: { ...args.path, timestampMethod: "receiveTime" },
      showPoints: false,
    });

    expect(result.data.length).toBe(2);
  });
});
