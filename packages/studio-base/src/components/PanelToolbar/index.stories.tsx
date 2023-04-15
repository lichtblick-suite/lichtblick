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
import { Box } from "@mui/material";
import { DecoratorFn, StoryFn } from "@storybook/react";
import { Mosaic, MosaicWindow } from "react-mosaic-component";

import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import { PanelStateContextProvider } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import PanelToolbar from "./index";

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

export const NonFloatingNarrow: StoryFn = () => {
  return (
    <MosaicWrapper width={268}>
      <PanelToolbar>
        <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>Some controls here</div>
      </PanelToolbar>
    </MosaicWrapper>
  );
};

NonFloatingNarrow.storyName = "non-floating (narrow)";

export const NonFloatingWideWithPanelName: StoryFn = () => {
  return (
    <MosaicWrapper width={468}>
      <PanelToolbar>
        <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>Some controls here</div>
      </PanelToolbar>
    </MosaicWrapper>
  );
};

NonFloatingWideWithPanelName.storyName = "non-floating (wide with panel name)";

export const OneAdditionalIcon: StoryFn = () => {
  const additionalIcons = (
    <ToolbarIconButton title="database icon">
      <Database20Filled />
    </ToolbarIconButton>
  );
  return (
    <MosaicWrapper width={468}>
      <PanelToolbar additionalIcons={additionalIcons}>
        <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>Some controls here</div>
      </PanelToolbar>
    </MosaicWrapper>
  );
};

OneAdditionalIcon.storyName = "one additional icon";

export const MenuOnlyPanel: StoryFn = () => {
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
};

MenuOnlyPanel.storyName = "menu (only panel)";
MenuOnlyPanel.parameters = { colorScheme: "dark" };

export const MenuLight: StoryFn = () => {
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
};

MenuLight.storyName = "menu light";
MenuLight.parameters = { colorScheme: "light" };

export const MenuWithSiblingPanel: StoryFn = () => {
  class Story extends React.Component {
    public override render() {
      return (
        <MosaicWrapper width={268} layout={{ direction: "row", first: "dummy", second: "Sibling" }}>
          <PanelToolbarWithOpenMenu />
        </MosaicWrapper>
      );
    }
  }
  return <Story />;
};

MenuWithSiblingPanel.storyName = "menu (with sibling panel)";
MenuWithSiblingPanel.parameters = { colorScheme: "dark" };

export const MenuForTabPanel: StoryFn = () => {
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
};

MenuForTabPanel.storyName = "menu for Tab panel";
MenuForTabPanel.parameters = { colorScheme: "dark" };

export const NoToolbars: StoryFn = () => {
  class Story extends React.Component {
    public override render() {
      return (
        <MosaicWrapper width={268} layout={{ direction: "row", first: "dummy", second: "Sibling" }}>
          <PanelToolbarWithOpenMenu />
        </MosaicWrapper>
      );
    }
  }
  return <Story />;
};

NoToolbars.storyName = "no toolbars";
NoToolbars.parameters = { colorScheme: "dark" };
