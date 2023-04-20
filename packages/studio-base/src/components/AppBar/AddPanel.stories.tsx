// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import { AddPanelMenu } from "./AddPanelMenu";
import { StorybookDecorator } from "./StorybookDecorator.stories";

export default {
  title: "components/AppBar/AddPanelMenu",
  component: AddPanelMenu,
  decorators: [StorybookDecorator],
};

export const Default: StoryObj = {
  render: () => {
    return (
      <>
        <AddPanelMenu
          open
          anchorReference="anchorPosition"
          anchorPosition={{ left: 0, top: 0 }}
          disablePortal
          handleClose={() => {
            // no-op
          }}
        />
      </>
    );
  },
};
