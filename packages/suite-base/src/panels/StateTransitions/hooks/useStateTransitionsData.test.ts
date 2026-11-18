/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Time } from "@lichtblick/rostime";
import {
  MessageAndData,
  MessageDataItemsByPath,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  messagesToDataset,
  StateTransitionDatasetBuilder,
} from "@lichtblick/suite-base/panels/StateTransitions/messagesToDataset";
import { StateTransitionPath } from "@lichtblick/suite-base/panels/StateTransitions/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import useStateTransitionsData, { DATASET_PATH_FIELDS } from "./useStateTransitionsData";

const PATH: StateTransitionPath = { value: "/topic.state", timestampMethod: "receiveTime" };
const START: Time = { sec: 100, nsec: 0 };
// Row of the first path: -(pathIndex + 1) * ROW_SPACING.
const Y = -9;

function buildItems(values: (number | null)[]): MessageAndData[] {
  return values.map((value, i) => ({
    messageEvent: MessageEventBuilder.messageEvent({
      topic: "/topic",
      receiveTime: { sec: 100 + i, nsec: 500_000_000 },
    }),
    queriedData: [{ value, path: PATH.value }],
  }));
}

function fullDataset(items: MessageAndData[], { showPoints }: { showPoints: boolean }) {
  return messagesToDataset({
    path: PATH,
    startTime: START,
    y: Y,
    pathIndex: 0,
    blocks: [items],
    showPoints,
  });
}

type HookProps = {
  paths: StateTransitionPath[];
  startTime: Time | undefined;
  blocks: MessageDataItemsByPath[];
  showPoints: boolean;
};

function renderData(initialProps: HookProps) {
  return renderHook(
    ({ paths, startTime, blocks, showPoints }: HookProps) =>
      useStateTransitionsData(paths, startTime, {}, blocks, showPoints),
    { initialProps },
  );
}

describe("useStateTransitionsData", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return default values when startTime is undefined", () => {
    const { result } = renderHook(() => useStateTransitionsData([], undefined, {}, [], false));
    expect(result.current).toEqual({
      data: { datasets: [] },
      minY: undefined,
      pathState: [],
    });
  });

  it("should return a block and a current-frame dataset per path with current-frame items", () => {
    // Given
    const paths: StateTransitionPath[] = [
      { value: "path1", timestampMethod: "receiveTime" },
      { value: "path2", timestampMethod: "receiveTime" },
    ];
    const itemsByPath: MessageDataItemsByPath = { path1: [], path2: [] };
    const decodedBlocks: MessageDataItemsByPath[] = [{ path1: [] }];

    // When
    const { result } = renderHook(() =>
      useStateTransitionsData(paths, RosTimeBuilder.time(), itemsByPath, decodedBlocks, true),
    );

    // Then
    expect(result.current.data.datasets).toHaveLength(4);
    expect(result.current.pathState).toEqual([
      { path: paths[0], isArray: false },
      { path: paths[1], isArray: false },
    ]);
    expect(result.current.minY).toBe(-20.25);
  });

  it("should skip the current-frame dataset when a path has no current-frame items", () => {
    // Given
    const paths: StateTransitionPath[] = [{ value: "path1", timestampMethod: "receiveTime" }];

    // When
    const { result } = renderHook(() =>
      useStateTransitionsData(paths, RosTimeBuilder.time(), {}, [], true),
    );

    // Then
    expect(result.current.data.datasets).toHaveLength(1);
    expect(result.current.pathState).toHaveLength(1);
    expect(result.current.minY).toBe(-11.25);
  });

  describe.each([
    false,
    true,
  ])("when range data arrives in batches (showPoints %s)", (showPoints) => {
    // Covers segments, a repeated value and a gap, so batch boundaries fall inside each of them.
    const values = [1, 1, 2, 2, null, 2, 3, 3, 3, null, null, 1];

    it.each(
      Array.from({ length: values.length + 1 }, (_, split) => split),
    )("should match a full rebuild when the first batch has %i messages", (split) => {
      // Given
      const allItems = buildItems(values);
      const block = allItems.slice(0, split);
      const { result, rerender } = renderData({
        paths: [PATH],
        startTime: START,
        blocks: [{ [PATH.value]: block }],
        showPoints,
      });

      // When
      block.push(...allItems.slice(split));
      rerender({ paths: [PATH], startTime: START, blocks: [{ [PATH.value]: block }], showPoints });

      // Then
      expect(result.current.data.datasets[0]).toEqual(fullDataset(allItems, { showPoints }));
    });
  });

  it("should only process messages added since the previous update", () => {
    // Given
    const appendSpy = jest.spyOn(StateTransitionDatasetBuilder.prototype, "append");
    const block = buildItems([1, 2, 3]);
    const { rerender } = renderData({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: block }],
      showPoints: false,
    });
    appendSpy.mockClear();

    // When
    block.push(...buildItems([4, 5]));
    rerender({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: block }],
      showPoints: false,
    });

    // Then
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(block, 3);
  });

  it("should rebuild when the block is replaced, e.g. after a seek", () => {
    // Given
    const { result, rerender } = renderData({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: buildItems([1, 1, 2, 2]) }],
      showPoints: false,
    });
    const replacement = buildItems([3]);

    // When
    rerender({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: replacement }],
      showPoints: false,
    });

    // Then
    expect(result.current.data.datasets[0]).toEqual(
      fullDataset(replacement, { showPoints: false }),
    );
  });

  it("should rebuild when showPoints changes", () => {
    // Given
    const block = buildItems([1, 1, 1, 2]);
    const { result, rerender } = renderData({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: block }],
      showPoints: false,
    });

    // When
    rerender({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: block }],
      showPoints: true,
    });

    // Then
    expect(result.current.data.datasets[0]).toEqual(fullDataset(block, { showPoints: true }));
  });

  it("should list every path field the dataset builder reads in DATASET_PATH_FIELDS", () => {
    // Given
    const readFields = new Set<string>();
    const recordingPath = (label: string | undefined) =>
      new Proxy(
        { ...PATH, label },
        {
          get(target, property, receiver) {
            if (typeof property === "string") {
              readFields.add(property);
            }
            return Reflect.get(target, property, receiver) as unknown;
          },
        },
      );
    const items = buildItems([1, 1, null, 2, 3]);

    // When: cover the builder's branches (with and without label, with and without points)
    for (const label of [undefined, "Label"]) {
      for (const showPoints of [false, true]) {
        messagesToDataset({
          path: recordingPath(label),
          startTime: START,
          y: Y,
          pathIndex: 0,
          blocks: [items],
          showPoints,
        });
      }
    }

    // Then
    expect(readFields.size).toBeGreaterThan(0);
    for (const field of readFields) {
      expect(DATASET_PATH_FIELDS).toContain(field);
    }
  });

  it.each([
    { field: "label", changed: { ...PATH, label: "New label" } },
    { field: "timestampMethod", changed: { ...PATH, timestampMethod: "headerStamp" as const } },
  ])("should rebuild when the path's $field changes", ({ changed }) => {
    // Given
    const block = buildItems([1, 1, 2]);
    const { result, rerender } = renderData({
      paths: [PATH],
      startTime: START,
      blocks: [{ [PATH.value]: block }],
      showPoints: false,
    });

    // When
    rerender({
      paths: [changed],
      startTime: START,
      blocks: [{ [PATH.value]: block }],
      showPoints: false,
    });

    // Then
    expect(result.current.data.datasets[0]).toEqual(
      messagesToDataset({
        path: changed,
        startTime: START,
        y: Y,
        pathIndex: 0,
        blocks: [block],
        showPoints: false,
      }),
    );
  });

  it("should rebuild when an earlier block grows while a later block already has data", () => {
    // Given
    const first = buildItems([1]);
    const second = buildItems([2]);
    const blocks = [{ [PATH.value]: first }, { [PATH.value]: second }];
    const { result, rerender } = renderData({
      paths: [PATH],
      startTime: START,
      blocks,
      showPoints: true,
    });

    // When
    first.push(...buildItems([5]));
    rerender({ paths: [PATH], startTime: START, blocks: [...blocks], showPoints: true });

    // Then
    expect(result.current.data.datasets[0]).toEqual(
      messagesToDataset({
        path: PATH,
        startTime: START,
        y: Y,
        pathIndex: 0,
        blocks: [first, second],
        showPoints: true,
      }),
    );
  });
});
