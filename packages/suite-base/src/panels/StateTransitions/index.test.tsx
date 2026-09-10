/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";

import { MessageDataItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import useMessagesByPath from "@lichtblick/suite-base/components/MessagePathSyntax/useMessagesByPath";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useDecodedMessageRange } from "./hooks/useDecodedMessageRange";
import { StateTransitionConfig } from "./types";

jest.mock("@lichtblick/suite-base/components/Panel", () => ({
  __esModule: true,
  default: (Component: React.ComponentType) =>
    Object.assign(Component, { panelType: "StateTransitions", defaultConfig: {} }),
}));

jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/useMessagesByPath");
jest.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useDecodedMessageRange");
jest.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsTime", () => ({
  __esModule: true,
  default: () => ({
    startTime: { sec: 0, nsec: 0 },
    currentTimeSinceStart: 0,
    endTimeSinceStart: 10,
  }),
}));
jest.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsData", () => ({
  __esModule: true,
  default: () => ({ pathState: [], data: { datasets: [] }, minY: 0 }),
}));
jest.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useChartScalesAndBounds", () => ({
  __esModule: true,
  default: () => ({
    yScale: {},
    xScale: {},
    databounds: { x: { min: 0, max: 10 }, y: { min: 0, max: 1 } },
    width: 800,
    sizeRef: { current: undefined },
  }),
}));
jest.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useMessagePathDropConfig");
jest.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/usePanelSettings");
// useStateTransitionsDeltaMode runs for real so measure-mode/annotation tests exercise actual
// marker placement - only its cross-panel sync dependency is stubbed out.
jest.mock("@lichtblick/suite-base/panels/shared/useDeltaMarkerSync");
jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: (selector: (ctx: unknown) => unknown) =>
    selector({ playerState: { presence: "PRESENT" } }),
  useMessagePipelineGetter: () => () => ({
    seekPlayback: jest.fn(),
    playerState: { activeData: { startTime: { sec: 0, nsec: 0 } } },
  }),
}));
jest.mock("@lichtblick/suite-base/components/PanelToolbar", () => ({
  __esModule: true,
  default: ({ additionalIcons }: { additionalIcons: React.ReactNode }) => (
    <div data-testid="panel-toolbar">{additionalIcons}</div>
  ),
}));
jest.mock("@lichtblick/suite-base/components/TimeBasedChart", () => ({
  __esModule: true,
  default: ({
    annotations,
    onClick,
  }: {
    annotations: unknown[];
    onClick: (arg: unknown) => void;
  }) => (
    <button
      data-testid="time-based-chart"
      data-annotation-count={annotations.length}
      onClick={() => {
        onClick({ x: 1, y: 0 });
      }}
    />
  ),
}));
jest.mock("@lichtblick/suite-base/panels/StateTransitions/PathLegend", () => ({
  PathLegend: () => <div data-testid="path-legend" />,
}));
jest.mock("@lichtblick/suite-base/panels/StateTransitions/StateTransitions.style", () => ({
  useStateTransitionsStyles: () => ({ classes: { chartWrapper: "chartWrapper" } }),
}));

const mockUseMessagesByPath = useMessagesByPath as jest.Mock;
const mockUseDecodedMessageRange = useDecodedMessageRange as jest.Mock;

function buildMessageAndData(path: string) {
  const topic = path.split(".")[0]!;
  return {
    messageEvent: MessageEventBuilder.messageEvent({ topic }),
    queriedData: [{ path, value: BasicBuilder.string() }],
  };
}

describe("StateTransitions", () => {
  const defaultConfig: StateTransitionConfig = {
    paths: [],
    isSynced: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDecodedMessageRange.mockReturnValue([{}]);
    mockUseMessagesByPath.mockReturnValue({});
  });

  function renderPanel(config: Partial<StateTransitionConfig> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const StateTransitionsPanel = require("./index").default;
    const saveConfig = jest.fn();
    return {
      ...render(
        <StateTransitionsPanel config={{ ...defaultConfig, ...config }} saveConfig={saveConfig} />,
      ),
      StateTransitionsPanel,
    };
  }

  it("should render the panel", () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId("time-based-chart")).toBeDefined();
    expect(getByTestId("path-legend")).toBeDefined();
  });

  it("should pass pathStrings to useMessagesByPath when no range data", () => {
    mockUseDecodedMessageRange.mockReturnValue([{}]);
    const topicA = BasicBuilder.string();
    const topicB = BasicBuilder.string();

    renderPanel({
      paths: [
        { value: topicA, timestampMethod: "receiveTime" },
        { value: topicB, timestampMethod: "receiveTime" },
      ],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([topicA, topicB]);
  });

  it("should remove marker annotations when a path timestamp source changes", () => {
    // Given
    const topic = BasicBuilder.string();
    const { rerender, StateTransitionsPanel } = renderPanel({
      paths: [{ value: topic, timestampMethod: "receiveTime" }],
    });
    fireEvent.click(screen.getByTestId("state-transitions-measure-mode-toggle"));
    fireEvent.click(screen.getByTestId("time-based-chart"));
    expect(screen.getByTestId("time-based-chart")).toHaveAttribute("data-annotation-count", "1");

    // When
    rerender(
      <StateTransitionsPanel
        config={{
          ...defaultConfig,
          paths: [{ value: topic, timestampMethod: "headerStamp" }],
        }}
        saveConfig={jest.fn()}
      />,
    );

    // Then
    expect(screen.getByTestId("time-based-chart")).toHaveAttribute("data-annotation-count", "0");
  });

  it("should pass empty array to useMessagesByPath when range data is active", () => {
    const topic = BasicBuilder.string();
    const decodedMessages: MessageDataItemsByPath[] = [{ [topic]: [buildMessageAndData(topic)] }];
    mockUseDecodedMessageRange.mockReturnValue(decodedMessages);

    renderPanel({
      paths: [{ value: topic, timestampMethod: "receiveTime" }],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([]);
  });

  it("should pass pathStrings when decodedMessages has matching paths but empty arrays", () => {
    const topic = BasicBuilder.string();
    const decodedMessages: MessageDataItemsByPath[] = [{ [topic]: [] }];
    mockUseDecodedMessageRange.mockReturnValue(decodedMessages);

    renderPanel({
      paths: [{ value: topic, timestampMethod: "receiveTime" }],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([topic]);
  });

  it("should skip useMessagesByPath when any path has range data", () => {
    const topicA = BasicBuilder.string();
    const topicB = BasicBuilder.string();
    const decodedMessages: MessageDataItemsByPath[] = [
      {
        [topicA]: [buildMessageAndData(topicA)],
        [topicB]: [],
      },
    ];
    mockUseDecodedMessageRange.mockReturnValue(decodedMessages);

    renderPanel({
      paths: [
        { value: topicA, timestampMethod: "receiveTime" },
        { value: topicB, timestampMethod: "receiveTime" },
      ],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([]);
  });
});
