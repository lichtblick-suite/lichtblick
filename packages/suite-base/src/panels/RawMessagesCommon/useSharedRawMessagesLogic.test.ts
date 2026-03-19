/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
    ...renderHook(() => useSharedRawMessagesLogic(input)),
    input,
    saveConfig: input.saveConfig as jest.Mock,
  };
};
describe("given useSharedRawMessagesLogic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe("when toggling diff", () => {
    it("then enables diff when currently disabled", () => {
      const { result, saveConfig } = setup();

      act(() => {
        result.current.onToggleDiff();
      });

      expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ diffEnabled: true }));
    });

    it("then disables diff when currently enabled", () => {
      const { result, saveConfig } = setup({
        config: {
          diffEnabled: true,
        },
      });

      act(() => {
        result.current.onToggleDiff();
      });

      expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ diffEnabled: false }));
    });
  });
  describe("when toggling expand-all", () => {
    it("then expands all when starting from 'none'", () => {
      const { result, saveConfig } = setup({
        config: {
          expansion: "none",
        },
      });

      expect(result.current.canExpandAll).toBe(true);

      act(() => {
        result.current.onToggleExpandAll();
      });

      expect(result.current.expansion).toBe("all");
      expect(result.current.canExpandAll).toBe(false);
      expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ expansion: "all" }));
    });
    it("then collapses all when starting from 'all'", () => {
      const { result, saveConfig } = setup({
        config: {
          expansion: "all",
        },
      });

      expect(result.current.canExpandAll).toBe(false);

      act(() => {
        result.current.onToggleExpandAll();
      });

      expect(result.current.expansion).toBe("none");
      expect(result.current.canExpandAll).toBe(true);
      expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ expansion: "none" }));
    });
  });

  describe("when topic path changes and expansion is 'all'", () => {
    it("then resets expansion to 'none'", () => {
      const { result, saveConfig } = setup({
        config: {
          expansion: "all",
        },
      });

      act(() => {
        result.current.onTopicPathChange("/new/topic");
      });

      expect(saveConfig).toHaveBeenCalledWith(expect.objectContaining({ topicPath: "/new/topic" }));
      expect(result.current.expansion).toBe("none");
    });
  });
  describe("when label is clicked", () => {
    it("then toggles expansion", () => {
      const { result, saveConfig } = setup({
        config: {
          expansion: "none",
        },
      });

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
