/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { renderHook, act } from "@testing-library/react";

import type { SharedConfig, UseSharedRawMessagesLogicProps } from "./types";
import { useSharedRawMessagesLogic } from "./useSharedRawMessagesLogic";

// Minimal mocks for deps the hook uses
jest.mock("@lichtblick/suite-base/PanelAPI", () => ({
  useDataSourceInfo: () => ({ topics: [], datatypes: new Map() }),
}));
jest.mock("@lichtblick/suite-base/components/PanelContext", () => ({
  usePanelContext: () => ({ setMessagePathDropConfig: jest.fn() }),
}));
jest.mock("@lichtblick/suite-base/components/MessagePathSyntax/useMessageDataItem", () => ({
  useMessageDataItem: () => [],
}));

const setup = (inputOverride?: {
  config?: Partial<SharedConfig>;
  saveConfig?: UseSharedRawMessagesLogicProps<SharedConfig>["saveConfig"];
}) => {
  const defaultConfig: SharedConfig = {
    topicPath: "some/topic",
    diffMethod: "custom",
    diffTopicPath: "some/diff/topic",
    diffEnabled: false,
  };

  const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
    config: {
      ...defaultConfig,
      ...inputOverride?.config,
    },
    saveConfig: inputOverride?.saveConfig ?? jest.fn(),
  };

  return {
    input,
    saveConfig: input.saveConfig as jest.Mock,
  };
};
describe("given useSharedRawMessagesLogic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("when configuration handling", () => {
    it("then should initialize with default config", () => {
      const { input } = setup();

      expect(input.config.topicPath).toBe("some/topic");
      expect(input.config.diffEnabled).toBe(false);
    });

    it("then should override specific config properties", () => {
      const { input } = setup({
        config: {
          topicPath: "/custom/topic",
          diffEnabled: true,
        },
      });

      expect(input.config.topicPath).toBe("/custom/topic");
      expect(input.config.diffEnabled).toBe(true);
      // Other defaults should still apply
      expect(input.config.diffMethod).toBe("custom");
    });

    it("then should use custom saveConfig", () => {
      const mockSaveConfig = jest.fn((newConfig) => {
        return newConfig;
      });
      const { input, saveConfig } = setup({
        saveConfig: mockSaveConfig,
      });

      expect(input.saveConfig).toBe(mockSaveConfig);
      expect(saveConfig).toBe(mockSaveConfig);
    });
    describe("when toggling diff", () => {
      it("then enables diff when currently disabled", () => {
        const saveConfig = jest.fn();
        const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
          config: {
            topicPath: "/initial/topic",
            diffEnabled: false,
            diffMethod: "custom",
            diffTopicPath: "/diff/topic",
            expansion: "none",
          },
          saveConfig,
        };

        const { result } = renderHook(() => useSharedRawMessagesLogic(input));

        act(() => {
          result.current.onToggleDiff();
        });

        expect(saveConfig).toHaveBeenCalledWith({ diffEnabled: true });
      });

      it("then disables diff when currently enabled", () => {
        const saveConfig = jest.fn();
        const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
          config: {
            topicPath: "/initial/topic",
            diffEnabled: true,
            diffMethod: "custom",
            diffTopicPath: "/diff/topic",
            expansion: "none",
          },
          saveConfig,
        };

        const { result } = renderHook(() => useSharedRawMessagesLogic(input));

        act(() => {
          result.current.onToggleDiff();
        });

        expect(saveConfig).toHaveBeenCalledWith({ diffEnabled: false });
      });
    });

    describe("when toggling expand-all", () => {
      it("then expands all when starting from 'none'", () => {
        const saveConfig = jest.fn();
        const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
          config: {
            topicPath: "/initial/topic",
            diffEnabled: false,
            diffMethod: "custom",
            diffTopicPath: "",
            expansion: "none",
          },
          saveConfig,
        };

        const { result } = renderHook(() => useSharedRawMessagesLogic(input));

        expect(result.current.canExpandAll).toBe(true);

        act(() => {
          result.current.onToggleExpandAll();
        });

        expect(result.current.expansion).toBe("all");
        expect(result.current.canExpandAll).toBe(false);
        expect(saveConfig).toHaveBeenCalledWith({ expansion: "all" });
      });

      it("then collapses all when starting from 'all'", () => {
        const saveConfig = jest.fn();
        const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
          config: {
            topicPath: "/initial/topic",
            diffEnabled: false,
            diffMethod: "custom",
            diffTopicPath: "",
            expansion: "all",
          },
          saveConfig,
        };

        const { result } = renderHook(() => useSharedRawMessagesLogic(input));

        expect(result.current.canExpandAll).toBe(false);

        act(() => {
          result.current.onToggleExpandAll();
        });

        expect(result.current.expansion).toBe("none");
        expect(result.current.canExpandAll).toBe(true);
        expect(saveConfig).toHaveBeenCalledWith({ expansion: "none" });
      });
    });
    describe("when topic path changes", () => {
      it("resets expansion to 'none'", () => {
        const saveConfig = jest.fn();
        const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
          config: {
            topicPath: "/initial/topic",
            diffEnabled: false,
            diffMethod: "custom",
            diffTopicPath: "",
            expansion: "all",
          },
          saveConfig,
        };

        const { result } = renderHook(() => useSharedRawMessagesLogic(input));

        expect(result.current.expansion).toBe("all");

        act(() => {
          result.current.onTopicPathChange("/new/topic");
        });

        expect(saveConfig).toHaveBeenCalledWith({ topicPath: "/new/topic" });
        expect(result.current.expansion).toBe("none");
      });
    });
    describe("when label is clicked", () => {
      it("then toggles expansion", () => {
        const saveConfig = jest.fn();
        const input: UseSharedRawMessagesLogicProps<SharedConfig> = {
          config: {
            topicPath: "/initial/topic",
            diffEnabled: false,
            diffMethod: "custom",
            diffTopicPath: "",
            expansion: "none",
          },
          saveConfig,
        };

        const { result } = renderHook(() => useSharedRawMessagesLogic(input));

        expect(result.current.expansion).toBe("none");

        act(() => {
          result.current.onLabelClick(["field1"]);
        });

        // After clicking a label, expansion should become an object state
        expect(typeof result.current.expansion).toBe("object");

        // The hook persists expansion via saveConfig
        expect(saveConfig).toHaveBeenCalledWith({
          expansion: expect.any(Object),
        });
      });
    });
  });
});
