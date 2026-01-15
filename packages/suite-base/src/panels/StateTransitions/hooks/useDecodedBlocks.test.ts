/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";

import { MessageEvent } from "@lichtblick/suite";
import { useBlocksSubscriptions } from "@lichtblick/suite-base/PanelAPI";
import { MessageBlock } from "@lichtblick/suite-base/PanelAPI/useBlocksSubscriptions";
import { useDecodeMessagePathsForMessagesByTopic } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useDecodedBlocks } from "./useDecodedBlocks";
import { StateTransitionPath } from "../types";

// Mock dependencies
jest.mock("@lichtblick/suite-base/PanelAPI");
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems");
jest.mock("@lichtblick/suite-base/players/subscribePayloadFromMessagePath");

describe("useDecodedBlocks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildMessageEvent(): MessageEvent {
    return {
      message: BasicBuilder.string(),
      receiveTime: RosTimeBuilder.time(),
      schemaName: BasicBuilder.string(),
      sizeInBytes: BasicBuilder.number(),
      topic: BasicBuilder.string(),
    };
  }

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

  it("should return decoded blocks", () => {
    const paths: StateTransitionPath[] = [
      buildStateTransitionPath(),
      buildStateTransitionPath(),
      buildStateTransitionPath({ timestampMethod: "headerStamp" }),
    ];

    const mockBlocks: MessageBlock[] = [
      { topic1: BasicBuilder.multiple(buildMessageEvent) },
      { topic2: BasicBuilder.multiple(buildMessageEvent) },
    ];

    const mockDecodeMessagePathsForMessagesByTopic = jest.fn().mockImplementation((blocks) => {
      return blocks;
    });

    (useBlocksSubscriptions as jest.Mock).mockReturnValue(mockBlocks);

    (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(
      mockDecodeMessagePathsForMessagesByTopic,
    );

    const { result } = renderHook(() => useDecodedBlocks(paths));

    expect(useBlocksSubscriptions).toHaveBeenCalledWith([]);
    expect(mockDecodeMessagePathsForMessagesByTopic).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(mockBlocks);
  });

  it("should handle empty paths", () => {
    const mockDecodeMessagePathsForMessagesByTopic = jest.fn().mockImplementation((blocks) => {
      return blocks[0];
    });

    (useDecodeMessagePathsForMessagesByTopic as jest.Mock).mockReturnValue(
      mockDecodeMessagePathsForMessagesByTopic,
    );

    const { result } = renderHook(() => useDecodedBlocks([]));

    expect(result.current).toEqual([]);
    expect(useBlocksSubscriptions).toHaveBeenCalledWith([]);
  });
});
