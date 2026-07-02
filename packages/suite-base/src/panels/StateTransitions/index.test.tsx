/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

import { MessageDataItemsByPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import useMessagesByPath from "@lichtblick/suite-base/components/MessagePathSyntax/useMessagesByPath";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { useDecodedMessageRange } from "./hooks/useDecodedMessageRange";
import { StateTransitionConfig } from "./types";

vi.mock("@lichtblick/suite-base/components/Panel", async () => ({
  __esModule: true,
  default: (Component: React.ComponentType) =>
    Object.assign(Component, { panelType: "StateTransitions", defaultConfig: {} }),
}));

vi.mock("@lichtblick/suite-base/components/MessagePathSyntax/useMessagesByPath");
vi.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useDecodedMessageRange");
vi.mock(
  "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsTime",
  async () => ({
    __esModule: true,
    default: () => ({
      startTime: { sec: 0, nsec: 0 },
      currentTimeSinceStart: 0,
      endTimeSinceStart: 10,
    }),
  }),
);
vi.mock(
  "@lichtblick/suite-base/panels/StateTransitions/hooks/useStateTransitionsData",
  async () => ({
    __esModule: true,
    default: () => ({ pathState: [], data: { datasets: [] }, minY: 0 }),
  }),
);
vi.mock(
  "@lichtblick/suite-base/panels/StateTransitions/hooks/useChartScalesAndBounds",
  async () => ({
    __esModule: true,
    default: () => ({
      yScale: {},
      xScale: {},
      databounds: { x: { min: 0, max: 10 }, y: { min: 0, max: 1 } },
      width: 800,
      sizeRef: { current: undefined },
    }),
  }),
);
vi.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/useMessagePathDropConfig");
vi.mock("@lichtblick/suite-base/panels/StateTransitions/hooks/usePanelSettings");
vi.mock("@lichtblick/suite-base/components/MessagePipeline", async () => ({
  useMessagePipeline: (selector: (ctx: unknown) => unknown) =>
    selector({ playerState: { presence: "PRESENT" } }),
  useMessagePipelineGetter: () => () => ({
    seekPlayback: vi.fn(),
    playerState: { activeData: { startTime: { sec: 0, nsec: 0 } } },
  }),
}));
vi.mock("@lichtblick/suite-base/components/PanelToolbar", async () => ({
  __esModule: true,
  default: () => <div data-testid="panel-toolbar" />,
}));
vi.mock("@lichtblick/suite-base/components/TimeBasedChart", async () => ({
  __esModule: true,
  default: () => <div data-testid="time-based-chart" />,
}));
vi.mock("@lichtblick/suite-base/panels/StateTransitions/PathLegend", async () => ({
  PathLegend: () => <div data-testid="path-legend" />,
}));
vi.mock("@lichtblick/suite-base/panels/StateTransitions/StateTransitions.style", async () => ({
  useStateTransitionsStyles: () => ({ classes: { chartWrapper: "chartWrapper" } }),
}));

const mockUseMessagesByPath = useMessagesByPath as Mock;
const mockUseDecodedMessageRange = useDecodedMessageRange as Mock;

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
    vi.clearAllMocks();
    mockUseDecodedMessageRange.mockReturnValue([{}]);
    mockUseMessagesByPath.mockReturnValue({});
  });

  async function renderPanel(config: Partial<StateTransitionConfig> = {}) {
    const { default: StateTransitionsPanel } = await import("./index");
    const saveConfig = vi.fn();
    return render(
      <StateTransitionsPanel config={{ ...defaultConfig, ...config }} saveConfig={saveConfig} />,
    );
  }

  it("should render the panel", async () => {
    const { getByTestId } = await renderPanel();
    expect(getByTestId("time-based-chart")).toBeDefined();
    expect(getByTestId("path-legend")).toBeDefined();
  });

  it("should pass pathStrings to useMessagesByPath when no range data", async () => {
    mockUseDecodedMessageRange.mockReturnValue([{}]);
    const topicA = BasicBuilder.string();
    const topicB = BasicBuilder.string();

    await renderPanel({
      paths: [
        { value: topicA, timestampMethod: "receiveTime" },
        { value: topicB, timestampMethod: "receiveTime" },
      ],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([topicA, topicB]);
  });

  it("should pass empty array to useMessagesByPath when range data is active", async () => {
    const topic = BasicBuilder.string();
    const decodedMessages: MessageDataItemsByPath[] = [{ [topic]: [buildMessageAndData(topic)] }];
    mockUseDecodedMessageRange.mockReturnValue(decodedMessages);

    await renderPanel({
      paths: [{ value: topic, timestampMethod: "receiveTime" }],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([]);
  });

  it("should pass pathStrings when decodedMessages has matching paths but empty arrays", async () => {
    const topic = BasicBuilder.string();
    const decodedMessages: MessageDataItemsByPath[] = [{ [topic]: [] }];
    mockUseDecodedMessageRange.mockReturnValue(decodedMessages);

    await renderPanel({
      paths: [{ value: topic, timestampMethod: "receiveTime" }],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([topic]);
  });

  it("should skip useMessagesByPath when any path has range data", async () => {
    const topicA = BasicBuilder.string();
    const topicB = BasicBuilder.string();
    const decodedMessages: MessageDataItemsByPath[] = [
      {
        [topicA]: [buildMessageAndData(topicA)],
        [topicB]: [],
      },
    ];
    mockUseDecodedMessageRange.mockReturnValue(decodedMessages);

    await renderPanel({
      paths: [
        { value: topicA, timestampMethod: "receiveTime" },
        { value: topicB, timestampMethod: "receiveTime" },
      ],
    });

    expect(mockUseMessagesByPath).toHaveBeenCalledWith([]);
  });
});
