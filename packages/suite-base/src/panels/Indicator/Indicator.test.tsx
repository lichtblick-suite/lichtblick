/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { userEvent } from "@storybook/testing-library";
import { render, screen } from "@testing-library/react";
import React from "react";

import { PanelExtensionContext } from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { PanelExtensionAdapter } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import Indicator from "@lichtblick/suite-base/panels/Indicator";
import { getMatchingRule } from "@lichtblick/suite-base/panels/Indicator/getMatchingRule";
import { IndicatorConfig, IndicatorProps } from "@lichtblick/suite-base/panels/Indicator/types";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import IndicatorBuilder from "@lichtblick/suite-base/testing/builders/IndicatorBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

jest.mock("./getMatchingRule", () => ({
  getMatchingRule: jest.fn(),
}));

type Setup = {
  configOverride?: Partial<IndicatorConfig>;
  contextOverride?: Partial<PanelExtensionContext>;
};

describe("Indicator Component", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setup({ contextOverride, configOverride }: Setup = {}) {
    const props: IndicatorProps = {
      context: {
        initialState: {},
        layout: {
          addPanel: jest.fn(),
        },
        onRender: undefined,
        panelElement: document.createElement("div"),
        saveState: jest.fn(),
        setDefaultPanelTitle: jest.fn(),
        setParameter: jest.fn(),
        setPreviewTime: jest.fn(),
        setSharedPanelState: jest.fn(),
        setVariable: jest.fn(),
        subscribe: jest.fn(),
        subscribeAppSettings: jest.fn(),
        unsubscribeAll: jest.fn(),
        updatePanelSettingsEditor: jest.fn(),
        watch: jest.fn(),
        ...contextOverride,
      },
    };

    const config: IndicatorConfig = {
      ...IndicatorBuilder.config(),
      ...configOverride,
    };
    const saveConfig = () => {};
    const initPanel = jest.fn();

    const ui: React.ReactElement = (
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup>
            <PanelExtensionAdapter config={config} saveConfig={saveConfig} initPanel={initPanel}>
              <Indicator {...props} />
            </PanelExtensionAdapter>
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>
    );

    const matchingRule = {
      color: "#68e24a",
      label: BasicBuilder.string(),
    };
    (getMatchingRule as jest.Mock).mockReturnValue(matchingRule);

    const augmentColor = jest.fn(({ color: { main } }) => ({
      contrastText: `${main}-contrast`,
    }));

    return {
      ...render(ui),
      config,
      matchingRule,
      props,
      user: userEvent.setup(),
      augmentColor,
    };
  }

  it("renders Indicator component", () => {
    const { matchingRule } = setup();

    const element = screen.getByText(matchingRule.label);
    expect(element).toBeTruthy();
  });
});
