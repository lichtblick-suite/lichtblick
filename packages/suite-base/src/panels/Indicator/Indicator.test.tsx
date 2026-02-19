/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { userEvent } from "@storybook/testing-library";
import { render, screen } from "@testing-library/react";
import React from "react";

import { PanelExtensionContext } from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { PanelExtensionAdapter } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import Indicator from "@lichtblick/suite-base/panels/Indicator";
import { DEFAULT_CONFIG } from "@lichtblick/suite-base/panels/Indicator/constants";
import { getMatchingRule } from "@lichtblick/suite-base/panels/Indicator/getMatchingRule";
import {
  IndicatorConfig,
  IndicatorProps,
  IndicatorStyle,
} from "@lichtblick/suite-base/panels/Indicator/types";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import IndicatorBuilder from "@lichtblick/suite-base/testing/builders/IndicatorBuilder";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

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
    const config: IndicatorConfig = {
      ...IndicatorBuilder.config(),
      ...configOverride,
    };

    const props: IndicatorProps = {
      context: {
        initialState: config,
        layout: {
          addPanel: jest.fn(),
        },
        onRender: jest.fn(),
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
        unstable_subscribeMessageRange: jest.fn(),
        ...contextOverride,
      },
    };

    const saveConfig = () => {};
    const initPanel = jest.fn();

    const ui: React.ReactElement = (
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup>
            <PanelExtensionAdapter
              config={DEFAULT_CONFIG}
              saveConfig={saveConfig}
              initPanel={initPanel}
            >
              <Indicator overrideConfig={config} />
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
      saveConfig,
      initPanel,
    };
  }

  it("renders Indicator component", () => {
    const { matchingRule } = setup();

    expect(screen.getByText(matchingRule.label)).toBeTruthy();
  });

  it("renders with custom configuration", () => {
    const customConfig: Partial<IndicatorConfig> = {
      path: BasicBuilder.string(),
      style: "background",
      fallbackColor: "#ff0000",
    };

    const { config } = setup({ configOverride: customConfig });

    expect(config).toMatchObject(customConfig);
  });

  it.each<IndicatorStyle>(["bulb", "background"])(
    "renders with the proper style indicator",
    (style) => {
      const { matchingRule } = setup({
        configOverride: {
          style,
        },
      });

      expect(screen.getByTestId(`${style}-indicator`)).toBeTruthy();
      expect(screen.getByText(matchingRule.label)).toBeTruthy();
    },
  );
});
