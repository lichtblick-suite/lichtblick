// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Database20Filled } from "@fluentui/react-icons";
import { useTheme } from "@mui/material";
import { StoryObj, StoryFn } from "@storybook/react";
import { fireEvent, screen } from "@storybook/testing-library";
import { PropsWithChildren } from "react";
import { Mosaic, MosaicWindow } from "react-mosaic-component";

import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { PanelStateContextProvider } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import PanelToolbar from "./index";

import "react-mosaic-component/react-mosaic-component.css";

function MosaicWrapper(props: PropsWithChildren<{ layout?: any; width?: number }>): JSX.Element {
  const { children, layout = "dummy", width = 268 } = props;
  const theme = useTheme();

  return (
    <WorkspaceContextProvider>
      <Mosaic
        onChange={() => undefined}
        renderTile={(id, path) => (
          <MosaicWindow
            title="test"
            path={path}
            toolbarControls={<div />}
            renderPreview={() => undefined as any}
          >
            <PanelStateContextProvider>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  padding: theme.spacing(3),
                  position: "relative",
                  backgroundColor: theme.palette.background.default,
                }}
              >
                <div style={{ width }}>{id === "Sibling" ? "Sibling Panel" : children}</div>
              </div>
            </PanelStateContextProvider>
          </MosaicWindow>
        )}
        value={layout}
        className="mosaic-foxglove-theme" // prevent the default mosaic theme from being applied
      />
    </WorkspaceContextProvider>
  );
}

export default {
  title: "components/PanelToolbar",
  decorators: [
    (Story: StoryFn): JSX.Element => {
      // Provide all stories with PanelContext and current layout
      return (
        <MockCurrentLayoutProvider>
          <MockPanelContextProvider>
            <Story />
          </MockPanelContextProvider>
        </MockCurrentLayoutProvider>
      );
    },
  ],
};

const ToolbarContent = (): JSX.Element => (
  <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>Some controls here</div>
);

type PanelToolbarStoryObj = StoryObj<{ width?: number; layout?: any }>;

export const NonFloatingNarrow: PanelToolbarStoryObj = {
  render: () => {
    return (
      <MosaicWrapper>
        <PanelToolbar>
          <ToolbarContent />
        </PanelToolbar>
      </MosaicWrapper>
    );
  },
  name: "non-floating (narrow)",
};

export const NonFloatingWideWithPanelName: PanelToolbarStoryObj = {
  render: (args) => {
    return (
      <MosaicWrapper {...args}>
        <PanelToolbar>
          <ToolbarContent />
        </PanelToolbar>
      </MosaicWrapper>
    );
  },
  args: { width: 468 },
  name: "non-floating (wide with panel name)",
};

export const OneAdditionalIcon: PanelToolbarStoryObj = {
  render: (args) => {
    const additionalIcons = (
      <ToolbarIconButton title="database icon">
        <Database20Filled />
      </ToolbarIconButton>
    );
    return (
      <MosaicWrapper {...args}>
        <PanelToolbar additionalIcons={additionalIcons}>
          <ToolbarContent />
        </PanelToolbar>
      </MosaicWrapper>
    );
  },
  args: { width: 468 },
  name: "one additional icon",
};

export const MenuOnlyPanel: PanelToolbarStoryObj = {
  render: () => (
    <MosaicWrapper>
      <PanelToolbar>
        <ToolbarContent />
      </PanelToolbar>
    </MosaicWrapper>
  ),
  name: "menu (only panel)",
  parameters: { colorScheme: "dark" },
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
  },
};

export const MenuLight: PanelToolbarStoryObj = {
  render: () => (
    <MosaicWrapper>
      <PanelToolbar>
        <ToolbarContent />
      </PanelToolbar>
    </MosaicWrapper>
  ),
  name: "menu light",
  parameters: { colorScheme: "light" },
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
  },
};

export const MenuWithSiblingPanel: PanelToolbarStoryObj = {
  render: (args) => (
    <MosaicWrapper {...args}>
      <PanelToolbar>
        <ToolbarContent />
      </PanelToolbar>
    </MosaicWrapper>
  ),
  name: "menu (with sibling panel)",
  args: { layout: { direction: "row", first: "dummy", second: "Sibling" } },
  parameters: { colorScheme: "dark" },
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
  },
};

export const MenuForTabPanel: PanelToolbarStoryObj = {
  render: (args): JSX.Element => (
    <MosaicWrapper {...args}>
      <PanelToolbar>
        <ToolbarContent />
      </PanelToolbar>
    </MosaicWrapper>
  ),
  name: "menu for Tab panel",
  args: { layout: { direction: "row", first: "Tab", second: "Sibling" } },
  parameters: { colorScheme: "dark" },
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
  },
};

export const NoToolbars: PanelToolbarStoryObj = {
  render: (args) => (
    <MosaicWrapper {...args}>
      <PanelToolbar>
        <ToolbarContent />
      </PanelToolbar>
    </MosaicWrapper>
  ),
  args: { layout: { direction: "row", first: "dummy", second: "Sibling" } },
  name: "no toolbars",
  parameters: { colorScheme: "dark" },
  play: async () => {
    fireEvent.click(await screen.findByTestId("panel-menu"));
  },
};

export const Chinese: PanelToolbarStoryObj = {
  ...MenuLight,
  name: undefined,
  parameters: { forceLanguage: "zh", colorScheme: "light" },
};

export const Japanese: PanelToolbarStoryObj = {
  ...MenuLight,
  name: undefined,
  parameters: { forceLanguage: "ja", colorScheme: "light" },
};
