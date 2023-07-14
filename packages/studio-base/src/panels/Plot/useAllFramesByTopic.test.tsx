/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { Progress } from "@foxglove/studio-base/players/types";
import { mockMessage } from "@foxglove/studio-base/test/mocks/mockMessage";

import { useAllFramesByTopic } from "./useAllFramesByTopic";

describe("useAllFramesByTopic", () => {
  it("flattens blocks", () => {
    const initialProgress: Progress = {
      messageCache: {
        blocks: [
          {
            messagesByTopic: {
              topic_a: [mockMessage("message", { topic: "topic_a" })],
            },
            sizeInBytes: 1,
          },
        ],
        startTime: { sec: 0, nsec: 0 },
      },
    };

    const topics = ["topic_a", "topic_b"];

    const { result, rerender } = renderHook(() => useAllFramesByTopic(topics), {
      initialProps: { progress: initialProgress },
      wrapper: ({ children, progress }) => (
        <MockMessagePipelineProvider progress={progress}>{children}</MockMessagePipelineProvider>
      ),
    });

    expect(result.current).toEqual({
      topic_a: [expect.objectContaining({ topic: "topic_a" })],
      topic_b: [],
    });

    const updatedProgress: Progress = {
      messageCache: {
        blocks: [
          ...(initialProgress.messageCache?.blocks ?? []),
          {
            messagesByTopic: {
              topic_a: [mockMessage("message", { topic: "topic_a" })],
              topic_b: [mockMessage("message", { topic: "topic_b" })],
            },
            sizeInBytes: 1,
          },
        ],
        startTime: { sec: 0, nsec: 0 },
      },
    };

    rerender({ progress: updatedProgress });

    expect(result.current).toEqual({
      topic_a: [
        expect.objectContaining({ topic: "topic_a" }),
        expect.objectContaining({ topic: "topic_a" }),
      ],
      topic_b: [expect.objectContaining({ topic: "topic_b" })],
    });
  });
});
