/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { fireEvent, render } from "@testing-library/react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import MultiProvider from "@lichtblick/suite-base/components/MultiProvider";
import StudioToastProvider from "@lichtblick/suite-base/components/StudioToastProvider";
import AppConfigurationContext, {
  type AppConfigurationValue,
} from "@lichtblick/suite-base/context/AppConfigurationContext";
import LayoutManagerContext from "@lichtblick/suite-base/context/LayoutManagerContext";
import {
  useWorkspaceStore,
} from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import TimelineInteractionStateProvider from "@lichtblick/suite-base/providers/TimelineInteractionStateProvider";
import WorkspaceContextProvider from "@lichtblick/suite-base/providers/WorkspaceContextProvider";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";

import { AppBar } from ".";

function Wrapper({
  children,
  initialSettings,
}: React.PropsWithChildren<{ initialSettings?: Array<[string, unknown]> }>): React.JSX.Element {
  const appConfiguration = makeMockAppConfiguration(
    initialSettings as Array<[string, AppConfigurationValue]> | undefined,
  );
  const providers = [
    /* eslint-disable react/jsx-key */
    <WorkspaceContextProvider />,
    <AppConfigurationContext.Provider value={appConfiguration} />,
    <StudioToastProvider />,
    <TimelineInteractionStateProvider />,
    <MockMessagePipelineProvider />,
    <MockCurrentLayoutProvider />,
    <ThemeProvider isDark />,
    <LayoutManagerContext.Provider value={new MockLayoutManager()} />,
    /* eslint-enable react/jsx-key */
  ];
  return <MultiProvider providers={providers}>{children}</MultiProvider>;
}

describe("<AppBar />", () => {
  it("calls functions for custom window controls", async () => {
    const mockMinimize = jest.fn();
    const mockMaximize = jest.fn();
    const mockUnmaximize = jest.fn();
    const mockClose = jest.fn();

    const root = render(
      <Wrapper>
        <AppBar
          showCustomWindowControls
          onMinimizeWindow={mockMinimize}
          onMaximizeWindow={mockMaximize}
          onUnmaximizeWindow={mockUnmaximize}
          onCloseWindow={mockClose}
        />
      </Wrapper>,
    );

    const minButton = await root.findByTestId("win-minimize");
    minButton.click();
    expect(mockMinimize).toHaveBeenCalled();

    const maxButton = await root.findByTestId("win-maximize");
    maxButton.click();
    expect(mockMaximize).toHaveBeenCalled();
    expect(mockUnmaximize).not.toHaveBeenCalled();

    root.rerender(
      <Wrapper>
        <AppBar
          showCustomWindowControls
          onMinimizeWindow={mockMinimize}
          onMaximizeWindow={mockMaximize}
          onUnmaximizeWindow={mockUnmaximize}
          onCloseWindow={mockClose}
          isMaximized
          initialZoomFactor={1}
        />
      </Wrapper>,
    );
    maxButton.click();
    expect(mockUnmaximize).toHaveBeenCalled();

    const closeButton = await root.findByTestId("win-close");
    closeButton.click();
    expect(mockClose).toHaveBeenCalled();

    root.unmount();
  });

  it("shows the Agent Chat button only when the agent is enabled and opens agent-chat on click", async () => {
    const probe = jest.fn();
    function RightSidebarProbe(): ReactNull {
      probe(useWorkspaceStore((store) => store.sidebars.right));
      return null;
    }

    const withoutAgent = render(
      <Wrapper>
        <AppBar />
      </Wrapper>,
    );
    expect(withoutAgent.queryByTestId("agent-chat-button")).not.toBeInTheDocument();
    withoutAgent.unmount();

    const withAgent = render(
      <Wrapper initialSettings={[[AppSetting.AGENT_ENABLED, true]]}>
        <AppBar />
        <RightSidebarProbe />
      </Wrapper>,
    );
    const button = await withAgent.findByTestId("agent-chat-button");
    fireEvent.click(button);

    expect(probe).toHaveBeenLastCalledWith(
      expect.objectContaining({ item: "agent-chat", open: true }),
    );
    withAgent.unmount();
  });
});
