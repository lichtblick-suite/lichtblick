/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { renderHook } from "@testing-library/react";

import { parseMessagePath } from "@lichtblick/message-path";
import { fillInGlobalVariablesInPath } from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import useGlobalVariables from "@lichtblick/suite-base/hooks/useGlobalVariables";
import {
  PlotConfig,
  PlotXAxisVal,
  isReferenceLinePlotPathType,
} from "@lichtblick/suite-base/panels/Plot/utils/config";
import GlobalVariableBuilder from "@lichtblick/suite-base/testing/builders/GlobalVariableBuilder";
import PlotBuilder from "@lichtblick/suite-base/testing/builders/PlotBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import useSubscriptions from "./useSubscriptions";
import { pathToSubscribePayload } from "../utils/subscription";

vi.mock("@lichtblick/suite-base/components/MessagePipeline", async () => ({
  useMessagePipeline: vi.fn(),
}));

vi.mock("@lichtblick/message-path", async () => ({
  parseMessagePath: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems", async () => ({
    fillInGlobalVariablesInPath: vi.fn(),
  }),
);

vi.mock("../utils/config", async () => ({
  isReferenceLinePlotPathType: vi.fn(),
}));

vi.mock("../utils/subscription", async () => ({
  pathToSubscribePayload: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/useGlobalVariables", async () => ({
  __esModule: true,
  default: vi.fn(),
}));

describe("useSubscriptions", () => {
  const setSubscriptions = vi.fn();
  const globalVariables = GlobalVariableBuilder.globalVariables();

  (useMessagePipeline as Mock).mockReturnValue(setSubscriptions);
  (useGlobalVariables as Mock).mockReturnValue({ globalVariables });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setup = (
    override: {
      config?: Partial<PlotConfig>;
      subscriberId?: string;
    } = {},
  ) => {
    const config: PlotConfig = {
      ...PlotBuilder.config(),
      ...override.config,
    } as unknown as PlotConfig;

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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => false);
      (parseMessagePath as Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as Mock).mockImplementation(() => "");
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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => false);
      (parseMessagePath as Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as Mock).mockImplementation(() => "");
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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => false);
      (parseMessagePath as Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as Mock).mockImplementation(() => "");

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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => false);
      (parseMessagePath as Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as Mock).mockImplementation(() => "");

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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => false);
      (parseMessagePath as Mock).mockImplementation(() => parsedPath);
      (fillInGlobalVariablesInPath as Mock).mockImplementation(() => filledInGlobalVarsPath);
      (pathToSubscribePayload as Mock).mockImplementation(() => "");

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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => true);
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
      (isReferenceLinePlotPathType as Mock).mockImplementation(() => false);
      (parseMessagePath as Mock).mockImplementation(() => undefined);
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
});
