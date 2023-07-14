/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { MessageEvent, PlayerStateActiveData, Topic } from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { usePlotPanelData } from "./usePlotPanelData";

const topics: Topic[] = [{ name: "/topic", schemaName: "datatype" }];
const datatypes: RosDatatypes = new Map(
  Object.entries({
    datatype: {
      definitions: [{ name: "value", type: "uint32", isArray: false, isComplex: false }],
    },
  }),
);

const fixtureMessages1: MessageEvent[] = [
  {
    topic: "/topic",
    receiveTime: { sec: 0, nsec: 0 },
    message: { value: 0 },
    schemaName: "datatype",
    sizeInBytes: 0,
  },
];

const fixtureMessages2: MessageEvent[] = [
  {
    topic: "/topic",
    receiveTime: { sec: 1, nsec: 0 },
    message: { value: 1 },
    schemaName: "datatype",
    sizeInBytes: 0,
  },
];

describe("usePlotPanelDatasets", () => {
  it("doesn't accumulate frames when showing single messages", () => {
    const testActiveData: PlayerStateActiveData = {
      messages: [],
      totalBytesReceived: 0,
      currentTime: { sec: 0, nsec: 0 },
      startTime: { sec: 0, nsec: 0 },
      endTime: { sec: 3, nsec: 0 },
      isPlaying: false,
      speed: 1,
      lastSeekTime: 0,
      topics,
      topicStats: new Map(),
      datatypes,
    };

    const initialProps = {
      activeData: testActiveData,
      allPaths: ["/topic.value"],
      followingView: undefined,
      showSingleCurrentMessage: true,
      startTime: { sec: 0, nsec: 0 },
      xAxisVal: "timestamp",
      yAxisPaths: [{ value: "/topic.value", enabled: true, timestampMethod: "receiveTime" }],
    } as const;

    const { result, rerender } = renderHook(
      ({ activeData: _, ...props }) => usePlotPanelData(props),
      {
        initialProps,
        wrapper: ({ children, activeData }) => {
          return (
            <MockCurrentLayoutProvider>
              <MockMessagePipelineProvider topics={topics} activeData={activeData}>
                {children}
              </MockMessagePipelineProvider>
            </MockCurrentLayoutProvider>
          );
        },
      },
    );

    rerender({
      ...initialProps,
      activeData: {
        ...initialProps.activeData,
        currentTime: { sec: 1, nsec: 0 },
        lastSeekTime: 1,
        messages: fixtureMessages1,
      },
    });

    rerender({
      ...initialProps,
      activeData: {
        ...initialProps.activeData,
        currentTime: { sec: 2, nsec: 0 },
        lastSeekTime: 2,
        messages: fixtureMessages2,
      },
    });

    expect(result.current).toEqual({
      bounds: expect.any(Object),
      datasets: [
        {
          data: [],
          label: "/topic.value",
        },
      ],
      pathsWithMismatchedDataLengths: [],
    });
  });
});
