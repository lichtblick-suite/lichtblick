/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen } from "@testing-library/react";
import React from "react";

import MultiProvider from "@lichtblick/suite-base/components/MultiProvider";
import PlayerManager from "@lichtblick/suite-base/components/PlayerManager";
import StudioToastProvider from "@lichtblick/suite-base/components/StudioToastProvider";
import { IAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";
import LayoutStorageContext from "@lichtblick/suite-base/context/LayoutStorageContext";
import NativeAppMenuContext, {
  INativeAppMenu,
} from "@lichtblick/suite-base/context/NativeAppMenuContext";
import NativeWindowContext, {
  INativeWindow,
} from "@lichtblick/suite-base/context/NativeWindowContext";
import { UserScriptStateProvider } from "@lichtblick/suite-base/context/UserScriptStateContext";
import AlertsContextProvider from "@lichtblick/suite-base/providers/AlertsContextProvider";
import AppParametersProvider from "@lichtblick/suite-base/providers/AppParametersProvider";
import CurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider";
import EventsProvider from "@lichtblick/suite-base/providers/EventsProvider";
import ExtensionCatalogProvider from "@lichtblick/suite-base/providers/ExtensionCatalogProvider";
import ExtensionMarketplaceProvider from "@lichtblick/suite-base/providers/ExtensionMarketplaceProvider";
import LayoutManagerProvider from "@lichtblick/suite-base/providers/LayoutManagerProvider";
import { StudioLogsSettingsProvider } from "@lichtblick/suite-base/providers/StudioLogsSettingsProvider";
import TimelineInteractionStateProvider from "@lichtblick/suite-base/providers/TimelineInteractionStateProvider";
import UserProfileLocalStorageProvider from "@lichtblick/suite-base/providers/UserProfileLocalStorageProvider";
import { BasicBuilder } from "@lichtblick/test-builders";

import { App, AppProps } from "./App";
import Workspace from "./Workspace";

function mockProvider(testId: string) {
  return jest.fn(({ children }) => <div data-testid={testId}>{children}</div>);
}

// Mocking shared providers and components
jest.mock("./providers/LayoutManagerProvider", () => mockProvider("layout-manager-provider"));
jest.mock("./providers/PanelCatalogProvider", () => mockProvider("panel-catalog-provider"));
jest.mock("./providers/AppParametersProvider", () => mockProvider("app-parameters-provider"));
jest.mock("./components/MultiProvider", () => mockProvider("multi-provider"));
jest.mock("./components/StudioToastProvider", () => mockProvider("studio-toast-provider"));
jest.mock("./components/GlobalCss", () => mockProvider("global-css"));
jest.mock("./components/DocumentTitleAdapter", () => mockProvider("document-title-adapter"));
jest.mock("./components/ErrorBoundary", () => mockProvider("error-boundary"));
jest.mock("./components/ColorSchemeThemeProvider", () => ({
  ColorSchemeThemeProvider: mockProvider("color-scheme-theme"),
}));
jest.mock("./components/CssBaseline", () => mockProvider("css-baseline"));
jest.mock("./components/SendNotificationToastAdapter", () =>
  mockProvider("send-notification-toast-adapter"),
);
jest.mock("./context/NativeAppMenuContext", () => ({
  Provider: mockProvider("native-app-component"),
}));
jest.mock("./Workspace", () => mockProvider("workspace-component"));
jest.mock("./screens/LaunchPreference", () => ({
  LaunchPreference: mockProvider("launch-preference"),
}));

// Mocked App configuration
const mockAppConfiguration: IAppConfiguration = {
  get: jest.fn(),
  set: jest.fn(),
  addChangeListener: jest.fn(),
  removeChangeListener: jest.fn(),
};

// Helper to render the App with default props
const setup = (overrides: Partial<AppProps> = {}) => {
  const defaultProps: AppProps = {
    appParameters: {},
    appConfiguration: mockAppConfiguration,
    deepLinks: [],
    dataSources: [],
    extensionLoaders: [],
    layoutLoaders: [],
    ...overrides,
  };
  return render(<App {...defaultProps} />);
};

describe("App Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    setup();
    expect(screen.getByTestId("app-parameters-provider")).toBeDefined();
    expect(screen.getByTestId("color-scheme-theme")).toBeDefined();
    expect(screen.getByTestId("css-baseline")).toBeDefined();
    expect(screen.getByTestId("error-boundary")).toBeDefined();
    expect(screen.getByTestId("multi-provider")).toBeDefined();
    expect(screen.getByTestId("document-title-adapter")).toBeDefined();
    expect(screen.getByTestId("send-notification-toast-adapter")).toBeDefined();
    expect(screen.getByTestId("panel-catalog-provider")).toBeDefined();
    expect(screen.getByTestId("workspace-component")).toBeDefined();
  });

  it("renders GlobalCss when enableGlobalCss is true", () => {
    setup({ enableGlobalCss: true });
    expect(screen.getByTestId("global-css")).toBeDefined();
  });

  it("throw exception when enableGlobalCss is false", () => {
    setup({ enableGlobalCss: false });
    expect(() => screen.getByTestId("global-css")).toThrow();
  });

  it("adds and removes contextmenu event listener on mount/unmount", () => {
    const addEventListenerSpy = jest.spyOn(document, "addEventListener");
    const removeEventListenerSpy = jest.spyOn(document, "removeEventListener");

    const { unmount } = setup();

    expect(addEventListenerSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
    expect(removeEventListenerSpy).not.toHaveBeenCalled();
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
  });

  it("renders LaunchPreference component when enableLaunchPreferenceScreen is true", () => {
    setup({ enableLaunchPreferenceScreen: true });
    expect(screen.getByTestId("launch-preference")).toBeDefined();
  });

  it("does not render LaunchPreference component when enableLaunchPreferenceScreen is false", () => {
    setup({ enableLaunchPreferenceScreen: false });
    expect(screen.queryByTestId("launch-preference")).toBeNull();
  });

  it("passes deepLinks and onAppBarDoubleClick to Workspace", () => {
    const mockDeepLinks = ["link1", "link2"];
    const mockOnAppBarDoubleClick = jest.fn();
    expect(Workspace).not.toHaveBeenCalled();

    setup({
      deepLinks: mockDeepLinks,
      onAppBarDoubleClick: mockOnAppBarDoubleClick,
    });

    // Ensure Workspace receives the correct props by spying on Workspace
    expect(Workspace).toHaveBeenCalledWith(
      {
        deepLinks: mockDeepLinks,
        onAppBarDoubleClick: mockOnAppBarDoubleClick,
      },
      {},
    );
  });
});

describe("App Component MultiProvider Tests", () => {
  const expectedProviders = [
    TimelineInteractionStateProvider,
    UserScriptStateProvider,
    ExtensionMarketplaceProvider,
    ExtensionCatalogProvider,
    PlayerManager,
    EventsProvider,
    StudioToastProvider,
    StudioLogsSettingsProvider,
    AlertsContextProvider,
    CurrentLayoutProvider,
    UserProfileLocalStorageProvider,
    LayoutManagerProvider,
    LayoutStorageContext.Provider,
  ];

  function extractProviderTypes() {
    const props = (MultiProvider as jest.Mock).mock.calls[0][0];
    const providerTypes = props.providers.map((provider: React.ReactElement) => provider.type);
    return providerTypes;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("verifies that MultiProvider is called with correct providers", () => {
    setup();
    expect(screen.getByTestId("multi-provider")).toBeDefined();
    expect(screen.getByTestId("multi-provider").children).toHaveLength(3);
    expectedProviders.forEach((provider) => {
      expect(extractProviderTypes()).toContain(provider);
    });
  });

  it("verifies that AppParametersProvider is called with correct parameters", () => {
    const appParameters = {
      [BasicBuilder.string()]: BasicBuilder.string(),
      [BasicBuilder.string()]: BasicBuilder.string(),
      [BasicBuilder.string()]: BasicBuilder.string(),
    };
    setup({ appParameters });
    expect(screen.getByTestId("app-parameters-provider")).toBeDefined();

    const props = (AppParametersProvider as jest.Mock).mock.calls[0][0];
    expect(props.appParameters).toBe(appParameters);
  });

  it("verifies that MultiProvider has rendered all providers when its nativeApp", () => {
    setup({ nativeAppMenu: {} as INativeAppMenu });
    expect(extractProviderTypes()).toContain(NativeAppMenuContext.Provider);
  });

  it("verifies that MultiProvider has rendered all providers when its nativeWindow", () => {
    setup({ nativeWindow: {} as INativeWindow });
    expect(extractProviderTypes()).toContain(NativeWindowContext.Provider);
  });

  //add test for extraProviders
  it("verifies that MultiProvider has rendered all providers when it has extraProviders", () => {
    const extraProviders = [
      //ad key on data-testid
      <div key="1" data-testid="extra-provider" />,
      <div key="2" data-testid="extra-provider" />,
    ];
    setup({ extraProviders });

    expect(extractProviderTypes()).toContain(extraProviders[0]?.type);
    expect(extractProviderTypes()).toHaveLength(expectedProviders.length + 2);
  });
});
