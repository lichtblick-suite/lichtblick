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

import DatabaseIcon from "@mdi/svg/svg/database.svg";
import { Box } from "@mui/material";
import { storiesOf } from "@storybook/react";
import { Mosaic, MosaicWindow } from "react-mosaic-component";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import HelpInfoProvider from "@foxglove/studio-base/providers/HelpInfoProvider";
import { PanelSettingsEditorContextProvider } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";

import PanelToolbar from "./index";

class MosaicWrapper extends React.Component<{
  layout?: any;
  children: React.ReactNode;
  width?: number;
}> {
  public override render() {
    const { width } = this.props;
    return (
      <Mosaic
        onChange={() => undefined}
        renderTile={(id, path) => (
          <MosaicWindow
            title="test"
            path={path}
            toolbarControls={<div />}
            renderPreview={() => undefined as any}
          >
            <PanelSettingsEditorContextProvider>
              <HelpInfoProvider>
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
              </HelpInfoProvider>
            </PanelSettingsEditorContextProvider>
          </MosaicWindow>
        )}
        value={this.props.layout ?? "dummy"}
        className="mosaic-foxglove-theme" // prevent the default mosaic theme from being applied
      />
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
        <PanelToolbar helpContent={<div />}>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
          <KeepToolbarVisibleHack />
        </PanelToolbar>
      </div>
    );
  }
}

// Keep PanelToolbar visible by rendering an empty ChildToggle inside the toolbar
function KeepToolbarVisibleHack() {
  return (
    <ChildToggle
      isOpen={true}
      onToggle={() => {
        // no-op
      }}
      position="above"
    >
      <span />
      <span />
    </ChildToggle>
  );
}

storiesOf("components/PanelToolbar", module)
  .addDecorator((childrenRenderFcn) => {
    // Provide all stories with PanelContext and current layout
    return (
      <MockCurrentLayoutProvider>
        <MockPanelContextProvider>{childrenRenderFcn()}</MockPanelContextProvider>
      </MockCurrentLayoutProvider>
    );
  })
  .add("non-floating (narrow)", () => {
    return (
      <MosaicWrapper width={268}>
        <PanelToolbar helpContent={<div />}>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
          <KeepToolbarVisibleHack />
        </PanelToolbar>
      </MosaicWrapper>
    );
  })
  .add("non-floating (wide with panel name)", () => {
    return (
      <MosaicWrapper width={468}>
        <PanelToolbar helpContent={<div />}>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
          <KeepToolbarVisibleHack />
        </PanelToolbar>
      </MosaicWrapper>
    );
  })
  .add("one additional icon", () => {
    const additionalIcons = (
      <ToolbarIconButton title="database icon">
        <DatabaseIcon />
      </ToolbarIconButton>
    );
    return (
      <MosaicWrapper width={468}>
        <PanelToolbar helpContent={<div />} additionalIcons={additionalIcons}>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
          <KeepToolbarVisibleHack />
        </PanelToolbar>
      </MosaicWrapper>
    );
  })
  .add(
    "menu (only panel)",
    () => {
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
    { colorScheme: "dark" },
  )
  .add(
    "menu light",
    () => {
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
    { colorScheme: "light" },
  )
  .add(
    "menu (with sibling panel)",
    () => {
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
    { colorScheme: "dark" },
  )
  .add(
    "menu for Tab panel",
    () => {
      class Story extends React.Component {
        public override render() {
          return (
            <MosaicWrapper
              width={268}
              layout={{ direction: "row", first: "Tab", second: "Sibling" }}
            >
              <PanelToolbarWithOpenMenu />
            </MosaicWrapper>
          );
        }
      }
      return <Story />;
    },
    { colorScheme: "dark" },
  )
  .add(
    "no toolbars",
    () => {
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
    { colorScheme: "dark" },
  );
