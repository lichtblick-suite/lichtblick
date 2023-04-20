// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";
import { StoryObj } from "@storybook/react";

import DirectionalPad from "./DirectionalPad";

export default {
  title: "panels/Teleop/DirectionalPad",
  component: DirectionalPad,
};

export const Basic: StoryObj = {
  render: () => {
    return <DirectionalPad onAction={action("click")} />;
  },
};

export const Disabled: StoryObj = {
  render: () => {
    return <DirectionalPad disabled onAction={action("click")} />;
  },
};
