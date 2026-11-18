/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook } from "@testing-library/react";
import { ComponentProps, createElement, PropsWithChildren } from "react";

import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { recordPipelineTickTelemetry } from "@lichtblick/suite-base/components/MessagePipeline/pipelineTelemetry";
import {
  createMessagePipelineStore,
  MessagePipelineInternalState,
} from "@lichtblick/suite-base/components/MessagePipeline/store";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import {
  PlotConfig,
  PlotXAxisVal,
  isReferenceLinePlotPathType,
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import GlobalVariableBuilder from "@lichtblick/suite-base/testing/builders/GlobalVariableBuilder";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import { setTelemetrySink } from "@lichtblick/suite-base/util/telemetry";
import { TelemetryBuilder } from "@lichtblick/suite-base/util/telemetry/builders/TelemetryBuilder";
import { TelemetryMock } from "@lichtblick/suite-base/util/telemetry/builders/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import useSubscriptions from "./useSubscriptions";
import { pathToSubscribePayload } from "../utils/subscription";

jest.mock("@lichtblick/suite-base/components/MessagePipeline", () => ({
  useMessagePipeline: jest.fn(),
}));

jest.mock("@lichtblick/message-path", () => ({
  parseMessagePath: jest.fn(),
}));

jest.mock(
  "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems",
  () => ({
    fillInGlobalVariablesInPath: jest.fn(),
  }),
);

jest.mock("../utils/config", () => ({
  isReferenceLinePlotPathType: jest.fn(),
}));

jest.mock("../utils/subscription", () => ({
  pathToSubscribePayload: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useGlobalVariables", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("useSubscriptions", () => {
  const setSubscriptions = jest.fn();
  const globalVariables = GlobalVariableBuilder.globalVariables();

  (useMessagePipeline as jest.Mock).mockReturnValue(setSubscriptions);
  (useGlobalVariables as jest.Mock).mockReturnValue({ globalVariables });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setup = (override: { config?: Partial<PlotConfig>; subscriberId?: string } = {}) => {
    const config: PlotConfig = {
      ...PlotBuilder.config(),
      ...override.config,
    };

    const subscriberId = Object.hasOwn(override, "subscriberId")
      ? override.subscriberId!
      : BasicBuilder.string();

    return {
      ...renderHook(() => {
        useSubscriptions(config, subscriberId);
      }),
      config,
      subscriberId,
    };
  };

  describe("Setting subscriptions", () => {
    it("should set subscriptions when preload type is full", () => {
      const parsedPath = BasicBuilder.string();
      const filledInGlobalVarsPath = BasicBuilder.string();
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => false);
      (parseMessagePath as jest.Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as jest.Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as jest.Mock).mockImplementation(() => "");
      const { subscriberId, config } = setup({
        config: {
          xAxisVal: "timestamp",
        },
      });

      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
      expect(isReferenceLinePlotPathType).toHaveBeenCalledTimes(config.paths.length);
      expect(isReferenceLinePlotPathType).toHaveBeenNthCalledWith(1, config.paths[0]);
      expect(isReferenceLinePlotPathType).toHaveBeenNthCalledWith(2, config.paths[1]);
      expect(isReferenceLinePlotPathType).toHaveBeenNthCalledWith(3, config.paths[2]);
      expect(parseMessagePath).toHaveBeenCalledTimes(config.paths.length);
      expect(parseMessagePath).toHaveBeenNthCalledWith(1, config.paths[0]!.value);
      expect(parseMessagePath).toHaveBeenNthCalledWith(2, config.paths[1]!.value);
      expect(parseMessagePath).toHaveBeenNthCalledWith(3, config.paths[2]!.value);
      expect(fillInGlobalVariablesInPath).toHaveBeenCalledTimes(config.paths.length);
      expect(fillInGlobalVariablesInPath).toHaveBeenLastCalledWith(parsedPath, globalVariables);
      expect(pathToSubscribePayload).toHaveBeenCalledTimes(config.paths.length);
      expect(pathToSubscribePayload).toHaveBeenLastCalledWith(filledInGlobalVarsPath, "full");
    });

    it("should set subscriptions when preload type is partial", () => {
      const parsedPath = BasicBuilder.string();
      const filledInGlobalVarsPath = BasicBuilder.string();
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => false);
      (parseMessagePath as jest.Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as jest.Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as jest.Mock).mockImplementation(() => "");
      const { subscriberId, config } = setup({
        config: {
          xAxisVal: "index",
        },
      });

      expect(parseMessagePath).toHaveBeenCalledTimes(config.paths.length);
      expect(parseMessagePath).toHaveBeenNthCalledWith(1, config.paths[0]!.value);
      expect(parseMessagePath).toHaveBeenNthCalledWith(2, config.paths[1]!.value);
      expect(parseMessagePath).toHaveBeenNthCalledWith(3, config.paths[2]!.value);
      expect(isReferenceLinePlotPathType).toHaveBeenCalledTimes(config.paths.length);
      expect(isReferenceLinePlotPathType).toHaveBeenLastCalledWith(config.paths[2]);
      expect(fillInGlobalVariablesInPath).toHaveBeenCalledTimes(config.paths.length);
      expect(fillInGlobalVariablesInPath).toHaveBeenLastCalledWith(parsedPath, globalVariables);
      expect(pathToSubscribePayload).toHaveBeenCalledTimes(config.paths.length);
      expect(pathToSubscribePayload).toHaveBeenLastCalledWith(filledInGlobalVarsPath, "partial");
      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
    });

    it("should set subscriptions when xAxisVal is custom", () => {
      const parsedPath = BasicBuilder.string();
      const filledInGlobalVarsPath = BasicBuilder.string();
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => false);
      (parseMessagePath as jest.Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as jest.Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as jest.Mock).mockImplementation(() => "");

      const { subscriberId, config } = setup({
        config: {
          paths: [],
          xAxisVal: "custom",
        },
      });

      expect(parseMessagePath).toHaveBeenCalledTimes(1);
      expect(parseMessagePath).toHaveBeenCalledWith(config.xAxisPath?.value);
      expect(fillInGlobalVariablesInPath).toHaveBeenCalledTimes(1);
      expect(fillInGlobalVariablesInPath).toHaveBeenCalledWith(parsedPath, globalVariables);
      expect(pathToSubscribePayload).toHaveBeenCalledTimes(1);
      expect(pathToSubscribePayload).toHaveBeenCalledWith(filledInGlobalVarsPath, "full");
      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
    });

    it("should set subscriptions when xAxisVal is currentCustom", () => {
      const parsedPath = BasicBuilder.string();
      const filledInGlobalVarsPath = BasicBuilder.string();
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => false);
      (parseMessagePath as jest.Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as jest.Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as jest.Mock).mockImplementation(() => "");

      const { subscriberId, config } = setup({
        config: {
          paths: [],
          xAxisVal: "currentCustom",
        },
      });

      expect(parseMessagePath).toHaveBeenCalledTimes(1);
      expect(parseMessagePath).toHaveBeenCalledWith(config.xAxisPath?.value);
      expect(fillInGlobalVariablesInPath).toHaveBeenCalledTimes(1);
      expect(fillInGlobalVariablesInPath).toHaveBeenCalledWith(parsedPath, globalVariables);
      expect(pathToSubscribePayload).toHaveBeenCalledTimes(1);
      expect(pathToSubscribePayload).toHaveBeenCalledWith(filledInGlobalVarsPath, "partial");
      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
    });

    it("should set subscriptions when xAxisVal is currentCustom and parsedPath is undefined", () => {
      const parsedPath = undefined;
      const filledInGlobalVarsPath = BasicBuilder.string();
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => false);
      (parseMessagePath as jest.Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as jest.Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as jest.Mock).mockImplementation(() => "");

      const { subscriberId, config } = setup({
        config: {
          paths: [],
          xAxisVal: "currentCustom",
        },
      });

      expect(parseMessagePath).toHaveBeenCalledTimes(1);
      expect(parseMessagePath).toHaveBeenCalledWith(config.xAxisPath?.value);
      expect(fillInGlobalVariablesInPath).not.toHaveBeenCalled();
      expect(pathToSubscribePayload).not.toHaveBeenCalled();
      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
    });
  });

  describe("Unsubscribing", () => {
    it("unsubscribes on unmount", () => {
      const { unmount, subscriberId } = setup();

      unmount();

      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, []);
    });
  });

  describe("Handling invalid paths", () => {
    it("does not set subscriptions for invalid paths", () => {
      const { subscriberId } = setup({
        config: {
          xAxisVal: BasicBuilder.string() as PlotXAxisVal,
        },
      });

      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, []);
    });

    it("should not handle paths when isReferenceLinePlotPathType is true", () => {
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => true);
      const { subscriberId } = setup({
        config: {
          paths: PlotBuilder.paths(1),
          xAxisPath: undefined,
        },
      });

      expect(isReferenceLinePlotPathType).toHaveBeenCalledTimes(1);
      expect(parseMessagePath).not.toHaveBeenCalled();
      expect(fillInGlobalVariablesInPath).not.toHaveBeenCalled();
      expect(pathToSubscribePayload).not.toHaveBeenCalled();
      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
    });

    it("should not handle paths when parsedPath is undefined", () => {
      (isReferenceLinePlotPathType as jest.Mock).mockImplementation(() => false);
      (parseMessagePath as jest.Mock).mockImplementation(() => undefined);
      const { subscriberId } = setup({
        config: {
          paths: PlotBuilder.paths(1),
          xAxisPath: undefined,
        },
      });

      expect(isReferenceLinePlotPathType).toHaveBeenCalledTimes(1);
      expect(parseMessagePath).toHaveBeenCalledTimes(1);
      expect(fillInGlobalVariablesInPath).not.toHaveBeenCalled();
      expect(pathToSubscribePayload).not.toHaveBeenCalled();
      expect(setSubscriptions).toHaveBeenCalledWith(subscriberId, expect.any(Array));
    });
  });

  describe("Telemetry", () => {
    const PANEL_ID = "Plot!t3l3m";

    function installEnabledTelemetry(): TelemetryMock {
      const telemetry = TelemetryBuilder.mockTelemetry();
      setTelemetrySink(telemetry);
      return telemetry;
    }

    function tickState(subscriberId: string, sizeInBytes: number): MessagePipelineInternalState {
      const state = createMessagePipelineStore({
        promisesToWaitForRef: { current: [] },
        initialPlayer: undefined,
      }).getState();
      const messageEventsBySubscriberId = new Map([
        [subscriberId, [MessageEventBuilder.messageEvent({ sizeInBytes })]],
      ]);
      return { ...state, public: { ...state.public, messageEventsBySubscriberId } };
    }

    function renderInPanel(config: PlotConfig, subscriberId: string, panelTitle: string) {
      return renderHook(
        () => {
          useSubscriptions(config, subscriberId);
        },
        {
          wrapper: ({ children }: PropsWithChildren) =>
            createElement(
              MockPanelContextProvider,
              // `children` is required by the props type but is supplied by the third argument.
              { id: PANEL_ID, type: "Plot", title: panelTitle } as ComponentProps<
                typeof MockPanelContextProvider
              >,
              children,
            ),
        },
      );
    }

    afterEach(() => {
      setTelemetrySink(undefined);
    });

    it("should attribute the plot subscriber's deliveries to the layout panel id when telemetry is enabled", () => {
      // Given
      const telemetry = installEnabledTelemetry();
      const subscriberId = BasicBuilder.string();
      const panelTitle = BasicBuilder.string();
      renderInPanel(PlotBuilder.config(), subscriberId, panelTitle);

      // When
      recordPipelineTickTelemetry(telemetry, tickState(subscriberId, 24), undefined);

      // Then
      const labels = { panelId: PANEL_ID, panelType: "Plot" };
      expect(
        telemetry.counter.mock.calls.filter(([metric]) => metric.startsWith("panel.")),
      ).toEqual([
        ["panel.messages.delivered", 1, "count", "panel", labels],
        ["panel.messages.deliveredBytes", 24, "bytes", "panel", labels],
      ]);
      expect(JSON.stringify(telemetry.counter.mock.calls)).not.toContain(panelTitle);
    });

    it("should stop attributing deliveries to the panel after the plot unmounts", () => {
      // Given
      const telemetry = installEnabledTelemetry();
      const subscriberId = BasicBuilder.string();
      const { unmount } = renderInPanel(PlotBuilder.config(), subscriberId, "Plot title");

      // When
      unmount();
      recordPipelineTickTelemetry(telemetry, tickState(subscriberId, 24), undefined);

      // Then
      expect(
        telemetry.counter.mock.calls.filter(([metric]) => metric.startsWith("panel.")),
      ).toEqual([]);
    });
  });
});
