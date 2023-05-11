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
// eslint-disable-next-line no-restricted-imports
import { Box } from "@mui/material";
import { StoryObj, DecoratorFn } from "@storybook/react";
import { Mosaic, MosaicWindow } from "react-mosaic-component";

import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { PanelStateContextProvider } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import PanelToolbar from "./index";

import "react-mosaic-component/react-mosaic-component.css";

class MosaicWrapper extends React.Component<{
  layout?: any;
  children: React.ReactNode;
  width?: number;
}> {
  public override render() {
    const { width } = this.props;
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
                <Box
                  width="100%"
                  height="100%"
                  padding={3}
                  position="relative"
                  bgcolor="background.default"
                >
                  <Box width={width}>
                    {id === "Sibling" ? "Sibling Panel" : this.props.children}
                  </Box>
                </Box>
              </PanelStateContextProvider>
            </MosaicWindow>
          )}
          value={this.props.layout ?? "dummy"}
          className="mosaic-foxglove-theme" // prevent the default mosaic theme from being applied
        />
      </WorkspaceContextProvider>
    );
  }
}

class PanelToolbarWithOpenMenu extends React.PureComponent {
  public override render() {
    return (
      <div
        ref={(el) => {
          if (el) {
            // wait for Dimensions
            setTimeout(() => {
              const gearIcon = el.querySelector("[data-testid=panel-menu] > svg");
              gearIcon?.parentElement?.click();
            }, 100);
          }
        }}
      >
        <PanelToolbar>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
        </PanelToolbar>
      </div>
    );
  }
}

export default {
  title: "components/PanelToolbar",

  decorators: [
    ((childrenRenderFcn) => {
      // Provide all stories with PanelContext and current layout
      return (
        <MockCurrentLayoutProvider>
          <MockPanelContextProvider>{childrenRenderFcn()}</MockPanelContextProvider>
        </MockCurrentLayoutProvider>
      );
    }) as DecoratorFn,
  ],
};

export const NonFloatingNarrow: StoryObj = {
  render: () => {
    return (
      <MosaicWrapper width={268}>
        <PanelToolbar>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
        </PanelToolbar>
      </MosaicWrapper>
    );
  },

  name: "non-floating (narrow)",
};

export const NonFloatingWideWithPanelName: StoryObj = {
  render: () => {
    return (
      <MosaicWrapper width={468}>
        <PanelToolbar>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
        </PanelToolbar>
      </MosaicWrapper>
    );
  },

  name: "non-floating (wide with panel name)",
};

export const OneAdditionalIcon: StoryObj = {
  render: () => {
    const additionalIcons = (
      <ToolbarIconButton title="database icon">
        <Database20Filled />
      </ToolbarIconButton>
    );
    return (
      <MosaicWrapper width={468}>
        <PanelToolbar additionalIcons={additionalIcons}>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
        </PanelToolbar>
      </MosaicWrapper>
    );
  },

  name: "one additional icon",
};

export const MenuOnlyPanel: StoryObj = {
  render: () => {
    class Story extends React.Component {
      public override render() {
        return (
          <MosaicWrapper width={268}>
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  },

  name: "menu (only panel)",
  parameters: { colorScheme: "dark" },
};

export const MenuLight: StoryObj = {
  render: () => {
    class Story extends React.Component {
      public override render() {
        return (
          <MosaicWrapper width={268}>
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  },

  name: "menu light",
  parameters: { colorScheme: "light" },
};

export const MenuWithSiblingPanel: StoryObj = {
  render: () => {
    class Story extends React.Component {
      public override render() {
        return (
          <MosaicWrapper
            width={268}
            layout={{ direction: "row", first: "dummy", second: "Sibling" }}
          >
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  },

  name: "menu (with sibling panel)",
  parameters: { colorScheme: "dark" },
};

export const MenuForTabPanel: StoryObj = {
  render: () => {
    class Story extends React.Component {
      public override render() {
        return (
          <MosaicWrapper width={268} layout={{ direction: "row", first: "Tab", second: "Sibling" }}>
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  },

  name: "menu for Tab panel",
  parameters: { colorScheme: "dark" },
};

export const NoToolbars: StoryObj = {
  render: () => {
    class Story extends React.Component {
      public override render() {
        return (
          <MosaicWrapper
            width={268}
            layout={{ direction: "row", first: "dummy", second: "Sibling" }}
          >
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  },

  name: "no toolbars",
  parameters: { colorScheme: "dark" },
};
