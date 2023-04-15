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

import { StoryFn } from "@storybook/react";
import { noop } from "lodash";
import React, { ReactNode } from "react";

import { ToolbarTab } from "@foxglove/studio-base/panels/Tab/ToolbarTab";
import tick from "@foxglove/studio-base/util/tick";

const baseProps = {
  hidden: false,
  highlight: undefined,
  innerRef: undefined,
  isActive: false,
  isDragging: false,
  actions: {
    addTab: noop,
    removeTab: noop,
    selectTab: noop,
    setTabTitle: noop,
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

export const Default: StoryFn = () => (
  <Container>
    <ToolbarTab {...baseProps} />
  </Container>
);

Default.storyName = "default";

export const ActiveWithCloseIcon: StoryFn = () => (
  <Container>
    <ToolbarTab {...{ ...baseProps, isActive: true, tabCount: 3 }} />
  </Container>
);

ActiveWithCloseIcon.storyName = "active with close icon";

export const ActiveWithoutCloseIcon: StoryFn = () => (
  <Container>
    <ToolbarTab {...{ ...baseProps, isActive: true, tabCount: 1 }} />
  </Container>
);

ActiveWithoutCloseIcon.storyName = "active without close icon";

export const Hidden: StoryFn = () => (
  <Container>
    <ToolbarTab {...{ ...baseProps, hidden: true }} />
  </Container>
);

Hidden.storyName = "hidden";

export const Highlight: StoryFn = () => (
  <Container>
    <ToolbarTab {...{ ...baseProps, highlight: "before" }} />
  </Container>
);

Highlight.storyName = "highlight";

export const Dragging: StoryFn = () => (
  <Container>
    <ToolbarTab {...{ ...baseProps, isDragging: true }} />
  </Container>
);

Dragging.storyName = "dragging";

export const Editing: StoryFn = () => (
  <Container
    ref={async (el) => {
      await tick();
      if (el) {
        el.querySelectorAll("input")[0]?.click();
      }
    }}
  >
    <ToolbarTab {...{ ...baseProps, isActive: true }} />
  </Container>
);

Editing.storyName = "editing";
