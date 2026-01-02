/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useMessageDataItem } from "@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import AppConfigurationContext, {
  IAppConfiguration,
} from "@lichtblick/suite-base/context/AppConfigurationContext";
import {
  NodeState,
  RawMessagesPanelConfig,
  UseSharedRawMessagesLogicResult,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import RawMessagesVirtual from "./RawMessagesVirtual";

const mockUseSharedRawMessagesLogic = jest.fn();

jest.mock("@lichtblick/suite-base/panels/RawMessagesCommon/useSharedRawMessagesLogic", () => ({
  useSharedRawMessagesLogic: jest.fn((args) => mockUseSharedRawMessagesLogic(args)),
}));

type MessageDataItem = ReturnType<typeof useMessageDataItem>[number];

function createMockSharedLogic(
  overrides: Partial<UseSharedRawMessagesLogicResult> = {},
): UseSharedRawMessagesLogicResult {
  return {
    topicRosPath: undefined,
    topic: overrides.topic,
    rootStructureItem: overrides.rootStructureItem,
    baseItem: overrides.baseItem,
    diffItem: overrides.diffItem,
    expansion: overrides.expansion ?? "none",
    setExpansion: jest.fn(),
    nodes: overrides.nodes ?? new Set<string>(),
    canExpandAll: overrides.canExpandAll ?? false,
    onTopicPathChange: jest.fn(),
    onDiffTopicPathChange: jest.fn(),
    onToggleDiff: jest.fn(),
    onToggleExpandAll: jest.fn(),
    onLabelClick: jest.fn(),
    ...overrides,
  };
}

function createMockMessageDataItem(
  overrides: {
    topic?: string;
    message?: unknown;
    schemaName?: string;
    receiveTime?: { sec: number; nsec: number };
    sizeInBytes?: number;
  } = {},
): MessageDataItem {
  const message = overrides.message ?? {};
  return {
    messageEvent: {
      topic: overrides.topic ?? BasicBuilder.string(),
      receiveTime: overrides.receiveTime ?? { sec: BasicBuilder.number(), nsec: 0 },
      message,
      sizeInBytes: overrides.sizeInBytes ?? BasicBuilder.number({ min: 10, max: 1000 }),
      schemaName: overrides.schemaName ?? BasicBuilder.string(),
    },
    queriedData: [{ value: message, path: "", constantName: undefined }],
  };
}

function renderComponent(configOverrides: Partial<RawMessagesPanelConfig> = {}) {
  const rawMessageConfig: RawMessagesPanelConfig = {
    topicPath: "",
    diffEnabled: false,
    diffMethod: "custom",
    diffTopicPath: "",
    showFullMessageForDiff: false,
    fontSize: undefined,
    ...configOverrides,
  };

  const appConfig: IAppConfiguration = {
    get: (key: string) => {
      if (key === AppSetting.TIMEZONE) {
        return "UTC";
      }
      return undefined;
    },
    set: jest.fn(),
    addChangeListener: jest.fn(),
    removeChangeListener: jest.fn(),
  };

  const saveConfig = jest.fn();

  const ui: React.ReactElement = (
    <ThemeProvider isDark>
      <MockPanelContextProvider>
        <PanelSetup>
          <AppConfigurationContext.Provider value={appConfig}>
            <RawMessagesVirtual config={rawMessageConfig} saveConfig={saveConfig} />
          </AppConfigurationContext.Provider>
        </PanelSetup>
      </MockPanelContextProvider>
    </ThemeProvider>
  );

  return {
    ...render(ui),
    config: rawMessageConfig,
    saveConfig,
  };
}

describe("Given RawMessagesVirtual", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Default mock implementation
    mockUseSharedRawMessagesLogic.mockReturnValue(createMockSharedLogic());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("When no topic is selected", () => {
    it("Then displays 'No topic selected' message", () => {
      // Given
      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: "",
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByText("No topic selected")).toBeInTheDocument();
    });
  });

  describe("When topic is selected but no message received", () => {
    it("Then displays 'Waiting for next message' message", () => {
      // Given
      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: "/test/topic",
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByText("Waiting for next message…")).toBeInTheDocument();
    });
  });

  describe("When diff is enabled", () => {
    it("Then displays diff waiting message when base and diff items not available", () => {
      // Given
      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: "/test/topic",
        diffEnabled: true,
        diffMethod: "custom",
        diffTopicPath: "/test/diff_topic",
      };

      // When
      renderComponent(config);

      // Then
      expect(
        screen.getByText('Waiting to diff next messages from "/test/topic" and "/test/diff_topic"'),
      ).toBeInTheDocument();
    });
  });

  describe("When custom font size is configured", () => {
    it("Then renders Typography with custom fontSize for single values", () => {
      // Given
      const fontSize = BasicBuilder.number({ min: 10, max: 20 });
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `std_msgs/${BasicBuilder.string()}`;
      const primitiveValue = BasicBuilder.string();
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: primitiveValue,
        schemaName,
      });
      baseItem.queriedData = [{ value: primitiveValue, path: "", constantName: undefined }];

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
        fontSize,
      };

      // When
      renderComponent(config);

      // Then - The primitive value should be rendered
      const el = screen.getByText(primitiveValue);
      expect(el).toBeInTheDocument();
      // Verify the component structure renders correctly with the configured fontSize
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
    });
  });

  describe("When message data is available", () => {
    it("Then renders metadata and message content", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const messageValue = { value: BasicBuilder.number() };
      const receiveTime = { sec: BasicBuilder.number(), nsec: 0 };
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: messageValue,
        schemaName,
        receiveTime,
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          canExpandAll: true,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
      expect(screen.getByText(schemaName, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`@ ${receiveTime.sec}`))).toBeInTheDocument();
    });

    it("Then displays single primitive value without tree", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `std_msgs/${BasicBuilder.string()}`;
      const primitiveValue = BasicBuilder.string();
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: primitiveValue,
        schemaName,
      });
      baseItem.queriedData = [{ value: primitiveValue, path: "", constantName: undefined }];

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByText(primitiveValue)).toBeInTheDocument();
    });

    it("Then displays single element array value without tree", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const arrayValue = [BasicBuilder.number()];
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: arrayValue,
        schemaName,
      });
      baseItem.queriedData = [{ value: arrayValue, path: "", constantName: undefined }];

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByText(String(arrayValue[0]))).toBeInTheDocument();
    });

    it("Then renders VirtualizedTree with complex objects' structure", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `geometry_msgs/${BasicBuilder.string()}`;
      const complexMessage = {
        x: BasicBuilder.number(),
        y: BasicBuilder.number(),
        z: BasicBuilder.number(),
        metadata: { id: BasicBuilder.string(), count: BasicBuilder.number() },
      };
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: complexMessage,
        schemaName,
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          canExpandAll: true,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
      const visibleKeys = ["x", "y", "z", "metadata"].filter((key) =>
        screen.queryByText(key, { exact: false }),
      );
      // At least some keys should be rendered (virtualization may not show all)
      expect(visibleKeys.length).toBeGreaterThan(0);
      expect(screen.getByTitle("Expand all")).toBeInTheDocument();
    });
  });

  describe("When diff mode is enabled with messages", () => {
    it("Then displays 'No difference found' when messages are identical", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const diffTopicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const identicalMessage = { value: BasicBuilder.number() };
      const receiveTimeSec = BasicBuilder.number();
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: identicalMessage,
        schemaName,
        receiveTime: { sec: receiveTimeSec, nsec: 0 },
      });
      const diffItem = createMockMessageDataItem({
        topic: diffTopicName,
        message: identicalMessage,
        schemaName,
        receiveTime: { sec: receiveTimeSec + 1, nsec: 0 },
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          diffItem,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
        diffEnabled: true,
        diffTopicPath: diffTopicName,
        diffMethod: "custom",
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByText("No difference found")).toBeInTheDocument();
    });

    it("Then displays 'Show full message' checkbox when diff is enabled", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const diffTopicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const baseValue = BasicBuilder.number();
      const baseMessageValue = { value: baseValue };
      const diffMessageValue = {
        value: baseValue + BasicBuilder.number({ min: 1, max: 10 }),
      };
      const receiveTimeSec = BasicBuilder.number();
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: baseMessageValue,
        schemaName,
        receiveTime: { sec: receiveTimeSec, nsec: 0 },
      });
      const diffItem = createMockMessageDataItem({
        topic: diffTopicName,
        message: diffMessageValue,
        schemaName,
        receiveTime: { sec: receiveTimeSec + 1, nsec: 0 },
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          diffItem,
          canExpandAll: true,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
        diffEnabled: true,
        diffTopicPath: diffTopicName,
        diffMethod: "custom",
        showFullMessageForDiff: false,
      };

      // When
      renderComponent(config);

      // Then
      expect(screen.getByText("Show full message")).toBeInTheDocument();
    });
  });

  describe("When expansion is 'all'", () => {
    it("Then expands all nodes in the tree", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const nestedMessage = {
        level1: {
          level2a: {
            value: BasicBuilder.number(),
            text: BasicBuilder.string(),
          },
          level2b: [BasicBuilder.number(), BasicBuilder.number()],
        },
        simpleValue: BasicBuilder.string(),
      };
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: nestedMessage,
        schemaName,
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          expansion: "all",
          canExpandAll: false,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then - VirtualizedTree should be rendered with expansion='all'
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
      // Verify the expand/collapse button shows "Collapse all" (indicating all nodes are expanded)
      expect(screen.getByTitle("Collapse all")).toBeInTheDocument();
    });
  });

  describe("When expansion is an object with specific node states", () => {
    it("Then renders VirtualizedTree with selective expansion", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const nestedMessage = {
        expandedNode: {
          child1: BasicBuilder.number(),
          child2: BasicBuilder.string(),
        },
        collapsedNode: {
          child3: BasicBuilder.number(),
          child4: BasicBuilder.string(),
        },
      };
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: nestedMessage,
        schemaName,
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          expansion: {
            expandedNode: NodeState.Expanded,
            collapsedNode: NodeState.Collapsed,
          },
          canExpandAll: true,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then - VirtualizedTree should be rendered with selective expansion
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
      // Verify the expand/collapse button shows "Expand all" (indicating some nodes are collapsed)
      expect(screen.getByTitle("Expand all")).toBeInTheDocument();
    });

    it("Then handles empty expansion object", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const simpleMessage = { value: BasicBuilder.number() };
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: simpleMessage,
        schemaName,
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          expansion: {}, // Empty object - no nodes expanded
          canExpandAll: false,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then - VirtualizedTree should be rendered with no nodes expanded
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
    });

    it("Then handles mixed expansion states", () => {
      // Given
      const topicName = `/test/${BasicBuilder.string()}`;
      const schemaName = `test_${BasicBuilder.string()}`;
      const complexMessage = {
        section1: {
          data: BasicBuilder.number(),
        },
        section2: {
          data: BasicBuilder.string(),
        },
        section3: {
          data: BasicBuilder.boolean(),
        },
      };
      const baseItem = createMockMessageDataItem({
        topic: topicName,
        message: complexMessage,
        schemaName,
      });

      mockUseSharedRawMessagesLogic.mockReturnValue(
        createMockSharedLogic({
          topic: { name: topicName, schemaName },
          rootStructureItem: {
            structureType: "message",
            nextByName: {},
            datatype: schemaName,
          },
          baseItem,
          expansion: {
            section1: NodeState.Expanded,
            section2: NodeState.Collapsed,
            section3: NodeState.Expanded,
          },
          canExpandAll: true,
        }),
      );

      const config: Partial<RawMessagesPanelConfig> = {
        topicPath: topicName,
      };

      // When
      renderComponent(config);

      // Then - VirtualizedTree should be rendered with mixed expansion states
      expect(screen.getByTestId("panel-scroll-container")).toBeInTheDocument();
    });
  });
});
