// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { StoryObj } from "@storybook/react";
import * as _ from "lodash-es";
import React, { ReactNode } from "react";

import { ToolbarTab } from "@foxglove/studio-base/panels/Tab/ToolbarTab";

const baseProps = {
  hidden: false,
  highlight: undefined,
  innerRef: undefined,
  isActive: false,
  isDragging: false,
  actions: {
    addTab: _.noop,
    removeTab: _.noop,
    selectTab: _.noop,
    setTabTitle: _.noop,
  },
  tabCount: 1,
  tabIndex: 0,
  tabTitle: "Tab Title",
};

const Container = React.forwardRef<HTMLDivElement, { children?: ReactNode }>(function Container(
  { children }: any,
  ref,
) {
  return (
    <div style={{ margin: 8 }} ref={ref}>
      {children}
    </div>
  );
});

export default {
  title: "panels/Tab/ToolbarTab",
};

export const Default: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...baseProps} />
    </Container>
  ),

  name: "default",
};

export const ActiveWithCloseIcon: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...{ ...baseProps, isActive: true, tabCount: 3 }} />
    </Container>
  ),

  name: "active with close icon",
};

export const ActiveWithoutCloseIcon: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...{ ...baseProps, isActive: true, tabCount: 1 }} />
    </Container>
  ),

  name: "active without close icon",
};

export const Hidden: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...{ ...baseProps, hidden: true }} />
    </Container>
  ),

  name: "hidden",
};

export const Highlight: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...{ ...baseProps, highlight: "before" }} />
    </Container>
  ),

  name: "highlight",
};

export const Dragging: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...{ ...baseProps, isDragging: true }} />
    </Container>
  ),

  name: "dragging",
};

export const Editing: StoryObj = {
  render: () => (
    <Container>
      <ToolbarTab {...{ ...baseProps, isActive: true }} />
    </Container>
  ),

  name: "editing",
  play: () => {
    document.querySelectorAll("input")[0]!.click();
  },
};
