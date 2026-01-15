// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StateTransitionConfig } from "@lichtblick/suite-base/panels/StateTransitions/types";
import { OpenSiblingPanel } from "@lichtblick/suite-base/types/panels";
import { BasicBuilder } from "@lichtblick/test-builders";

import { openSiblingStateTransitionsPanel } from "./openSiblingStateTransitionsPanel";

type IOpenSiblingStateTransitionsPanelSetup = {
  topicName: string;
  config: Partial<StateTransitionConfig>;
};
describe("openSiblingStateTransitionsPanel", () => {
  let mockOpenSiblingPanel: OpenSiblingPanel;
  const topicName = BasicBuilder.string();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenSiblingPanel = jest.fn();
  });

  function setup({ config = {} }: Partial<IOpenSiblingStateTransitionsPanelSetup> = {}) {
    return {
      topicName,
      config: {
        paths: [],
        isSynced: false,
        ...config,
      },
    };
  }

  it("should call openSiblingPanel with correct parameters", () => {
    const config: StateTransitionConfig = { paths: [], isSynced: false };

    openSiblingStateTransitionsPanel(mockOpenSiblingPanel, topicName);
    const siblingConfigCreator = (mockOpenSiblingPanel as jest.Mock).mock.calls[0][0]
      .siblingConfigCreator;
    const newConfig = siblingConfigCreator(config);

    expect(mockOpenSiblingPanel).toHaveBeenCalledWith({
      panelType: "StateTransitions",
      updateIfExists: true,
      siblingConfigCreator: expect.any(Function),
    });
    expect(newConfig.paths).toEqual([{ value: topicName, timestampMethod: "receiveTime" }]);
  });

  it("should not duplicate paths in the config", () => {
    const { config } = setup({
      config: {
        paths: [{ value: topicName, timestampMethod: "receiveTime" }],
        isSynced: false,
      },
    });

    openSiblingStateTransitionsPanel(mockOpenSiblingPanel, topicName);
    const siblingConfigCreator = (mockOpenSiblingPanel as jest.Mock).mock.calls[0][0]
      .siblingConfigCreator;
    const newConfig = siblingConfigCreator(config);

    expect(newConfig.paths).toEqual([{ value: topicName, timestampMethod: "receiveTime" }]);
  });
});
