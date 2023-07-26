/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  MessageEvent,
  PlayerStateActiveData,
  Progress,
  Topic,
} from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { mockMessage } from "@foxglove/studio-base/test/mocks/mockMessage";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { usePlotPanelData } from "./usePlotPanelData";

jest.mock("@foxglove/studio-base/hooks/useGlobalVariables");

const topics: Topic[] = [{ name: "topic", schemaName: "schema" }];
const datatypes: RosDatatypes = new Map(
  Object.entries({
    datatype: {
      definitions: [{ name: "value", type: "uint32", isArray: false, isComplex: false }],
    },
  }),
);

const fixtureMessages1: MessageEvent[] = [mockMessage({ value: 1 })];

const fixtureMessages2: MessageEvent[] = [mockMessage({ value: 2 })];

const fixtureActiveData: PlayerStateActiveData = {
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

const fixtureInitialProps = {
  activeData: fixtureActiveData,
  allPaths: ["topic.values[0]"],
  followingView: undefined,
  showSingleCurrentMessage: false,
  startTime: { sec: 0, nsec: 0 },
  xAxisVal: "timestamp",
  yAxisPaths: [{ value: "topic.value", enabled: true, timestampMethod: "receiveTime" }],
} as const;

describe("usePlotPanelData", () => {
  it("doesn't accumulate frames when showing single messages", () => {
    const initialProps = { ...fixtureInitialProps, showSingleCurrentMessage: true };

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

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
          label: "topic.value",
        },
      ],
      pathsWithMismatchedDataLengths: [],
    });
  });

  it("updates data when global variables change", () => {
    const initialProps = { ...fixtureInitialProps };
    const progress: Progress = {
      fullyLoadedFractionRanges: [],
      messageCache: {
        startTime: { sec: 0, nsec: 0 },
        blocks: [
          {
            messagesByTopic: {
              topic: fixtureMessages1,
            },
            sizeInBytes: 1,
          },
        ],
      },
    };

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

    const { result, rerender } = renderHook(
      ({ activeData: _, ...props }) => usePlotPanelData(props),
      {
        initialProps,
        wrapper: ({ children, activeData }) => {
          return (
            <MockCurrentLayoutProvider>
              <MockMessagePipelineProvider
                topics={topics}
                activeData={activeData}
                progress={progress}
              >
                {children}
              </MockMessagePipelineProvider>
            </MockCurrentLayoutProvider>
          );
        },
      },
    );

    const initialOutput = result.current;

    rerender();

    expect(result.current).toBe(initialOutput);

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 2 } });

    rerender();

    expect(result.current).not.toBe(initialOutput);
  });
});
