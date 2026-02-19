/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { Time } from "@lichtblick/rostime";
import { MessageDataItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { messagesToDataset } from "@lichtblick/suite-base/panels/StateTransitions/messagesToDataset";
import { datasetContainsArray } from "@lichtblick/suite-base/panels/StateTransitions/shared";
import { StateTransitionPath } from "@lichtblick/suite-base/panels/StateTransitions/types";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";

import useStateTransitionsData from "./useStateTransitionsData";

jest.mock("@lichtblick/suite-base/panels/StateTransitions/messagesToDataset");
jest.mock("@lichtblick/suite-base/panels/StateTransitions/shared");

describe("useStateTransitionsData", () => {
  const mockMessagesToDataset = messagesToDataset as jest.Mock;
  const mockDatasetContainsArray = datasetContainsArray as jest.Mock;

  beforeEach(() => {
    mockMessagesToDataset.mockClear();
    mockDatasetContainsArray.mockClear();
  });

  it("should return default values when startTime is undefined", () => {
    const { result } = renderHook(() => useStateTransitionsData([], undefined, {}, [], false));
    expect(result.current).toEqual({
      data: { datasets: [] },
      minY: undefined,
      pathState: [],
    });
  });

  it("should process paths and return datasets and pathState", () => {
    const paths: StateTransitionPath[] = [
      { value: "path1", timestampMethod: "receiveTime" },
      { value: "path2", timestampMethod: "receiveTime" },
    ];
    const startTime: Readonly<Time> = RosTimeBuilder.time();
    const itemsByPath: MessageDataItemsByPath = {
      path1: [],
      path2: [],
    };
    const decodedBlocks: MessageDataItemsByPath[] = [{ path1: [] }];
    const showPoints = true;

    mockMessagesToDataset.mockImplementation(({ path }) => ({ label: path.value }));
    mockDatasetContainsArray.mockReturnValue(false);

    const { result } = renderHook(() =>
      useStateTransitionsData(paths, startTime, itemsByPath, decodedBlocks, showPoints),
    );

    expect(result.current.data.datasets).toHaveLength(4);
    expect(result.current.pathState).toHaveLength(2);
    expect(result.current.minY).toBe(-15);

    expect(mockMessagesToDataset).toHaveBeenCalledTimes(4);
    expect(mockDatasetContainsArray).toHaveBeenCalledTimes(2);
  });

  it("should handle undefined items in itemsByPath", () => {
    const paths: StateTransitionPath[] = [{ value: "path1", timestampMethod: "receiveTime" }];
    const startTime: Readonly<Time> = RosTimeBuilder.time();
    const itemsByPath: MessageDataItemsByPath = {};
    const decodedBlocks: MessageDataItemsByPath[] = [];
    const showPoints = true;

    mockMessagesToDataset.mockImplementation(({ path }) => ({ label: path.value }));
    mockDatasetContainsArray.mockReturnValue(false);

    const { result } = renderHook(() =>
      useStateTransitionsData(paths, startTime, itemsByPath, decodedBlocks, showPoints),
    );

    expect(result.current.data.datasets).toHaveLength(1);
    expect(result.current.pathState).toHaveLength(1);
    expect(result.current.minY).toBe(-9);

    expect(mockMessagesToDataset).toHaveBeenCalledTimes(1);
    expect(mockDatasetContainsArray).toHaveBeenCalledTimes(1);
  });
});
