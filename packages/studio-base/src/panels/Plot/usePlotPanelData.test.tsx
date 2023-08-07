/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";
import { produce } from "immer";
import { PropsWithChildren } from "react";
import { DeepWritable } from "ts-essentials";

import MockMessagePipelineProvider, {
  MockMessagePipelineProps,
} from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerStateActiveData, Progress, Topic } from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { mockMessage } from "@foxglove/studio-base/test/mocks/mockMessage";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

import { usePlotPanelData } from "./usePlotPanelData";

jest.mock("@foxglove/studio-base/hooks/useGlobalVariables");

const testTopics: Topic[] = [
  { name: "topic_a", schemaName: "schema" },
  { name: "topic_b", schemaName: "schema" },
];
const testDataTypes: RosDatatypes = new Map(
  Object.entries({
    schema: {
      definitions: [{ name: "value", type: "uint32", isArray: false, isComplex: false }],
    },
  }),
);

const fixtureActiveData: PlayerStateActiveData = {
  currentTime: { sec: 0, nsec: 0 },
  datatypes: testDataTypes,
  endTime: { sec: 3, nsec: 0 },
  isPlaying: false,
  lastSeekTime: 0,
  messages: [],
  speed: 1,
  startTime: { sec: 0, nsec: 0 },
  topics: testTopics,
  topicStats: new Map(),
  totalBytesReceived: 0,
};

type UsePlotPanelDataArgs = Parameters<typeof usePlotPanelData>[0];

const fixtureInitialProps: UsePlotPanelDataArgs = {
  followingView: undefined,
  showSingleCurrentMessage: false,
  startTime: { sec: 0, nsec: 0 },
  xAxisVal: "timestamp",
  yAxisPaths: [{ value: "topic_a.value", enabled: true, timestampMethod: "receiveTime" }],
} as const;

const testProgress: DeepWritable<Progress> = {
  fullyLoadedFractionRanges: [],
  messageCache: {
    startTime: { sec: 0, nsec: 0 },
    blocks: [
      {
        messagesByTopic: {
          topic_a: [mockMessage({ value: 1 }, { topic: "topic_a" })],
        },
        sizeInBytes: 1,
      },
    ],
  },
};

type WrapperProps = PropsWithChildren<{
  messagePipeline: MockMessagePipelineProps;
  plotPanelData: UsePlotPanelDataArgs;
}>;

const wrapperInitialProps: WrapperProps = {
  messagePipeline: { activeData: fixtureActiveData, datatypes: testDataTypes, topics: testTopics },
  plotPanelData: fixtureInitialProps,
};

function Wrapper(props: WrapperProps) {
  return (
    <MockCurrentLayoutProvider>
      <MockMessagePipelineProvider {...props.messagePipeline}>
        {props.children}
      </MockMessagePipelineProvider>
    </MockCurrentLayoutProvider>
  );
}

describe("usePlotPanelData", () => {
  it("accumulates frames and preserves empty datasets", () => {
    const initialProps = produce(wrapperInitialProps, (draft) => {
      draft.plotPanelData.yAxisPaths.push({
        value: "topic_b.value",
        enabled: true,
        timestampMethod: "receiveTime",
      });
    });

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

    const { result, rerender } = renderHook(
      ({ plotPanelData }) => usePlotPanelData(plotPanelData),
      { initialProps, wrapper: Wrapper },
    );

    rerender(
      produce(initialProps, (draft) => {
        draft.messagePipeline.activeData!.currentTime = { sec: 1, nsec: 0 };
        draft.messagePipeline.activeData!.lastSeekTime = 1;
        draft.messagePipeline.activeData!.messages = [
          mockMessage({ value: 1 }, { topic: "topic_a" }),
        ];
      }),
    );

    expect(result.current).toEqual({
      bounds: expect.any(Object),
      datasets: [
        expect.objectContaining({
          data: [expect.objectContaining({ value: 1, x: 0, y: 1 })],
          label: "topic_a.value",
        }),
        expect.objectContaining({
          data: [],
          label: "topic_b.value",
        }),
      ],
      pathsWithMismatchedDataLengths: [],
    });

    rerender(
      produce(initialProps, (draft) => {
        draft.messagePipeline.activeData!.currentTime = { sec: 2, nsec: 0 };
        draft.messagePipeline.activeData!.lastSeekTime = 2;
        draft.messagePipeline.activeData!.messages = [
          mockMessage({ value: 2 }, { topic: "topic_a", receiveTime: { sec: 1, nsec: 0 } }),
        ];
      }),
    );

    expect(result.current).toEqual({
      bounds: expect.any(Object),
      datasets: [
        expect.objectContaining({
          data: [
            expect.objectContaining({ value: 1, x: 0, y: 1 }),
            expect.objectContaining({ x: NaN, y: NaN }),
            expect.objectContaining({ value: 2, x: 1, y: 2 }),
          ],
          label: "topic_a.value",
        }),
        expect.objectContaining({
          data: [],
          label: "topic_b.value",
        }),
      ],
      pathsWithMismatchedDataLengths: [],
    });
  });

  it("doesn't accumulate frames when showing single messages", () => {
    const initialProps = produce(wrapperInitialProps, (draft) => {
      draft.plotPanelData.showSingleCurrentMessage = true;
    });

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

    const { result, rerender } = renderHook(
      ({ plotPanelData }) => usePlotPanelData(plotPanelData),
      { initialProps, wrapper: Wrapper },
    );

    rerender(
      produce(initialProps, (draft) => {
        draft.messagePipeline.activeData!.currentTime = { sec: 1, nsec: 0 };
        draft.messagePipeline.activeData!.lastSeekTime = 1;
        draft.messagePipeline.activeData!.messages = [
          mockMessage({ value: 1 }, { topic: "topic_a" }),
        ];
      }),
    );

    expect(result.current).toEqual({
      bounds: expect.any(Object),
      datasets: [
        expect.objectContaining({
          data: [expect.objectContaining({ value: 1, x: 0, y: 1 })],
          label: "topic_a.value",
        }),
      ],
      pathsWithMismatchedDataLengths: [],
    });

    rerender(
      produce(initialProps, (draft) => {
        draft.messagePipeline.activeData!.currentTime = { sec: 2, nsec: 0 };
        draft.messagePipeline.activeData!.lastSeekTime = 2;
        draft.messagePipeline.activeData!.messages = [
          mockMessage({ value: 2 }, { topic: "topic_a", receiveTime: { sec: 1, nsec: 0 } }),
        ];
      }),
    );

    expect(result.current).toEqual({
      bounds: expect.any(Object),
      datasets: [
        expect.objectContaining({
          data: [expect.objectContaining({ value: 2, x: 1, y: 2 })],
          label: "topic_a.value",
        }),
      ],
      pathsWithMismatchedDataLengths: [],
    });
  });

  it("updates data when global variables change", () => {
    const initialProps = produce(wrapperInitialProps, (draft) => {
      draft.messagePipeline.progress = testProgress;
    });

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

    const { result, rerender } = renderHook(
      ({ plotPanelData }) => usePlotPanelData(plotPanelData),
      { initialProps, wrapper: Wrapper },
    );

    const initialOutput = result.current;

    rerender();

    expect(result.current).toBe(initialOutput);

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 2 } });

    rerender();

    expect(result.current).not.toBe(initialOutput);
  });

  it("updates data when a new valid series path is added", () => {
    const initialProps = produce(wrapperInitialProps, (draft) => {
      draft.messagePipeline.progress = testProgress;
    });

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

    const { result, rerender } = renderHook(
      ({ plotPanelData }) => usePlotPanelData(plotPanelData),
      { initialProps, wrapper: Wrapper },
    );

    const initialOutput = result.current;

    rerender();

    expect(result.current).toBe(initialOutput);

    const secondProps = produce(initialProps, (draft) => {
      draft.plotPanelData.yAxisPaths.push({
        value: "topic_a.value",
        enabled: true,
        timestampMethod: "receiveTime",
      });
    });

    rerender(secondProps);

    expect(result.current).not.toBe(initialOutput);
  });

  it("doesn't update data when an invalid series path is added", () => {
    const initialProps = produce(wrapperInitialProps, (draft) => {
      draft.messagePipeline.progress = testProgress;
    });

    (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables: { var: 1 } });

    const { result, rerender } = renderHook(
      ({ plotPanelData }) => usePlotPanelData(plotPanelData),
      { initialProps, wrapper: Wrapper },
    );

    const initialOutput = result.current;

    rerender();

    expect(result.current).toBe(initialOutput);

    const secondProps = produce(initialProps, (draft) => {
      draft.plotPanelData.yAxisPaths.push({
        value: "nonsense",
        enabled: true,
        timestampMethod: "receiveTime",
      });
    });

    rerender(secondProps);

    expect(result.current).toBe(initialOutput);
  });
});
