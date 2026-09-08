// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageAndData } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDatum } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import {
  ImmutableDataset,
  StateTransitionPath,
} from "@lichtblick/suite-base/panels/StateTransitions/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import {
  datasetContainsArray,
  getValueAtTime,
  stateTransitionPathDisplayName,
} from "./shared";

describe("stateTransitionPathDisplayName", () => {
  function buildStateTransitionPath(
    overrideProps: Partial<StateTransitionPath> = {},
  ): StateTransitionPath {
    return {
      timestampMethod: BasicBuilder.sample(["receiveTime", "headerStamp"]),
      value: BasicBuilder.string(),
      enabled: true,
      label: BasicBuilder.string(),
      ...overrideProps,
    };
  }

  it("should return the path label if it is defined", () => {
    const path: StateTransitionPath = buildStateTransitionPath();
    expect(stateTransitionPathDisplayName(path, 0)).toEqual(path.label);
  });

  it("should return the path value if label is empty", () => {
    const path: StateTransitionPath = buildStateTransitionPath({
      label: "",
    });
    expect(stateTransitionPathDisplayName(path, 0)).toEqual(path.value);
  });

  it("should return the path value if label is undefined", () => {
    const path: StateTransitionPath = buildStateTransitionPath({
      label: undefined,
    });
    expect(stateTransitionPathDisplayName(path, 0)).toEqual(path.value);
  });

  it("should return the fallback display name if neither label or value are empty", () => {
    const path: StateTransitionPath = buildStateTransitionPath({
      label: "",
      value: "",
    });
    expect(stateTransitionPathDisplayName(path, 0)).toEqual("Series 1");
    expect(stateTransitionPathDisplayName(path, 1)).toEqual("Series 2");
    expect(stateTransitionPathDisplayName(path, 42)).toEqual("Series 43");
  });
});

describe("datasetContainsArray", () => {
  const createMessageAndData = (queriedDataLength: number): MessageAndData => ({
    messageEvent: MessageEventBuilder.messageEvent(), // Mock the MessageEvent
    queriedData: new Array(queriedDataLength).fill({}), // Create an array of the specified length
  });

  it("should return false for an empty dataset", () => {
    const dataset: ImmutableDataset = [];
    expect(datasetContainsArray(dataset)).toBe(false);
  });

  it("should return false when all elements are undefined", () => {
    const dataset: ImmutableDataset = [undefined, undefined];
    expect(datasetContainsArray(dataset)).toBe(false);
  });

  it("should return false when the dataset contains mixed undefined and empty arrays", () => {
    const dataset: ImmutableDataset = [undefined, []];
    expect(datasetContainsArray(dataset)).toBe(false);
  });

  it("should return false for a single MessageAndData[] element with queriedData of length 1", () => {
    const dataset: ImmutableDataset = [[createMessageAndData(1)]];
    expect(datasetContainsArray(dataset)).toBe(false);
  });

  it("should return true for a single MessageAndData[] element with queriedData of length greater than 1", () => {
    const dataset: ImmutableDataset = [[createMessageAndData(2)]];
    expect(datasetContainsArray(dataset)).toBe(true);
  });

  it("should return true for multiple MessageAndData[] elements with consistent queriedData lengths greater than 1", () => {
    const dataset: ImmutableDataset = [
      [createMessageAndData(2)],
      [createMessageAndData(2)],
    ];
    expect(datasetContainsArray(dataset)).toBe(true);
  });

  it("should return false for multiple MessageAndData[] elements with mixed queriedData lengths, including lengths less than or equal to 1", () => {
    const dataset: ImmutableDataset = [
      [createMessageAndData(2)],
      [createMessageAndData(1)],
    ];
    expect(datasetContainsArray(dataset)).toBe(false);
  });
});

describe("getValueAtTime", () => {
  function buildDatum(overrides: Partial<ChartDatum> = {}): ChartDatum {
    return {
      x: BasicBuilder.number(),
      y: 0,
      value: BasicBuilder.string(),
      ...overrides,
    };
  }

  it("should return undefined for empty data", () => {
    // Given / When
    const result = getValueAtTime([], 10);

    // Then
    expect(result).toBeUndefined();
  });

  it("should return undefined when time is before the first point", () => {
    // Given
    const data = [buildDatum({ x: 5, value: "IDLE" })];

    // When
    const result = getValueAtTime(data, 1);

    // Then
    expect(result).toBeUndefined();
  });

  it("should return the value of the point exactly at time", () => {
    // Given
    const data = [buildDatum({ x: 5, value: "IDLE" })];

    // When
    const result = getValueAtTime(data, 5);

    // Then
    expect(result).toEqual({
      value: "IDLE",
      constantName: undefined,
    });
  });

  it("should return the latest point at or before time", () => {
    // Given
    const data = [
      buildDatum({ x: 1, value: "IDLE" }),
      buildDatum({ x: 5, value: "RUNNING" }),
      buildDatum({ x: 20, value: "DONE" }),
    ];

    // When
    const result = getValueAtTime(data, 10);

    // Then
    expect(result).toEqual({
      value: "RUNNING",
      constantName: undefined,
    });
  });

  it("should include the constantName when present", () => {
    // Given
    const data = [buildDatum({ x: 1, value: 0, constantName: "IDLE" })];

    // When
    const result = getValueAtTime(data, 1);

    // Then
    expect(result).toEqual({ value: 0, constantName: "IDLE" });
  });

  it("should return undefined once time crosses a gap (a point without a value)", () => {
    // Given
    const data = [
      buildDatum({ x: 1, value: "RUNNING" }),
      { x: 5, y: Number.NaN },
      buildDatum({ x: 10, value: "IDLE" }),
    ];

    // When
    const result = getValueAtTime(data, 7);

    // Then
    expect(result).toBeUndefined();
  });

  it("should skip undefined entries", () => {
    // Given
    const data = [
      buildDatum({ x: 1, value: "IDLE" }),
      undefined,
      buildDatum({ x: 10, value: "DONE" }),
    ];

    // When
    const result = getValueAtTime(data, 3);

    // Then
    expect(result).toEqual({
      value: "IDLE",
      constantName: undefined,
    });
  });
});
