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
import { storiesOf } from "@storybook/react";
import { Mosaic, MosaicWindow } from "react-mosaic-component";
import { Provider } from "react-redux";

import ChildToggle from "@foxglove-studio/app/components/ChildToggle";
import Icon from "@foxglove-studio/app/components/Icon";
import MockPanelContextProvider from "@foxglove-studio/app/components/MockPanelContextProvider";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

import PanelToolbar from "./index";

class MosaicWrapper extends React.Component<{
  layout?: any;
  children: React.ReactNode;
  width?: number;
}> {
  render() {
    const { width = 300 } = this.props;
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
            <div style={{ width, height: 300, padding: 30, position: "relative" }}>
              {id === "Sibling" ? "Sibling Panel" : this.props.children}
            </div>
          </MosaicWindow>
        )}
        value={this.props.layout || "dummy"}
        className="none"
      />
    );
  }
}

class PanelToolbarWithOpenMenu extends React.PureComponent<{ hideToolbars?: boolean }> {
  render() {
    return (
      <div
        ref={(el) => {
          if (el) {
            // wait for Dimensions
            setTimeout(() => {
              const gearIcon = el.querySelectorAll("svg")[1];
              gearIcon?.parentElement?.click();
            }, 100);
          }
        }}
      >
        <PanelToolbar hideToolbars={this.props.hideToolbars} helpContent={<div />}>
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
    // Provide all stories with PanelContext and redux state
    return (
      <Provider store={configureStore(createRootReducer())}>
        <MockPanelContextProvider>{childrenRenderFcn()}</MockPanelContextProvider>
      </Provider>
    );
  })
  .add("non-floating (narrow)", () => {
    return (
      <MosaicWrapper>
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
      <MosaicWrapper width={500}>
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
      <Icon>
        <DatabaseIcon />
      </Icon>
    );
    return (
      <MosaicWrapper width={500}>
        <PanelToolbar helpContent={<div />} additionalIcons={additionalIcons}>
          <div style={{ width: "100%", lineHeight: "22px", paddingLeft: 5 }}>
            Some controls here
          </div>
          <KeepToolbarVisibleHack />
        </PanelToolbar>
      </MosaicWrapper>
    );
  })
  .add("menu (only panel)", () => {
    class Story extends React.Component {
      render() {
        return (
          <MosaicWrapper>
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  })
  .add("menu (with sibling panel)", () => {
    class Story extends React.Component {
      render() {
        return (
          <MosaicWrapper layout={{ direction: "row", first: "dummy", second: "Sibling" }}>
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  })
  .add("menu for Tab panel", () => {
    class Story extends React.Component {
      render() {
        return (
          <MosaicWrapper layout={{ direction: "row", first: "Tab", second: "Sibling" }}>
            <PanelToolbarWithOpenMenu />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  })
  .add("no toolbars", () => {
    class Story extends React.Component {
      render() {
        return (
          <MosaicWrapper layout={{ direction: "row", first: "dummy", second: "Sibling" }}>
            <PanelToolbarWithOpenMenu hideToolbars />
          </MosaicWrapper>
        );
      }
    }
    return <Story />;
  });
