/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { useTopicPublishFrequencies } from "@foxglove/studio-base/hooks/useTopicPublishFrequences";
import { PlayerCapabilities, PlayerState } from "@foxglove/studio-base/players/types";

describe("useSynchronousMountedState", () => {
  it("calculates frequences for a static source", () => {
    const activeData: Partial<PlayerState["activeData"]> = {
      currentTime: { sec: 2, nsec: 0 },
      endTime: { sec: 10, nsec: 0 },
      startTime: { sec: 0, nsec: 0 },
      topicStats: new Map([
        [
          "topic_a",
          {
            numMessages: 10,
            firstMessageTime: { sec: 1, nsec: 0 },
            lastMessageTime: { sec: 5, nsec: 0 },
          },
        ],
        [
          "topic_b",
          {
            numMessages: 20,
            firstMessageTime: { sec: 2, nsec: 0 },
            lastMessageTime: { sec: 7, nsec: 0 },
          },
        ],
      ]),
    };

    const { result } = renderHook(useTopicPublishFrequencies, {
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider
          activeData={activeData}
          capabilities={[PlayerCapabilities.playbackControl]}
        >
          {children}
        </MockMessagePipelineProvider>
      ),
    });

    expect(result.current).toStrictEqual({ topic_a: 2.25, topic_b: 3.8 });
  });

  it("updates frequences for a live source", () => {
    let activeData: Partial<PlayerState["activeData"]> = {
      currentTime: { sec: 2, nsec: 0 },
      endTime: { sec: 10, nsec: 0 },
      startTime: { sec: 0, nsec: 0 },
      topicStats: new Map([
        ["topic_a", { numMessages: 10 }],
        ["topic_b", { numMessages: 20 }],
      ]),
    };

    const { result, rerender } = renderHook(useTopicPublishFrequencies, {
      wrapper: ({ children }) => (
        <MockMessagePipelineProvider activeData={activeData}>
          {children}
        </MockMessagePipelineProvider>
      ),
    });

    expect(result.current).toStrictEqual({});

    activeData = {
      currentTime: { sec: 3, nsec: 0 },
      endTime: { sec: 10, nsec: 0 },
      startTime: { sec: 0, nsec: 0 },
      topicStats: new Map([
        ["topic_a", { numMessages: 20 }],
        ["topic_b", { numMessages: 40 }],
      ]),
    };
    rerender();

    expect(result.current["topic_a"]).toBeGreaterThan(0);
    expect(result.current["topic_b"]).toBeGreaterThan(0);
  });
});
