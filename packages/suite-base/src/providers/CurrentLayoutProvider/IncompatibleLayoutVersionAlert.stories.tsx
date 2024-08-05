// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import { IncompatibleLayoutVersionAlert } from "./IncompatibleLayoutVersionAlert";

export default {
  title: "components/IncompatibleLayoutVersionAlert",
  component: IncompatibleLayoutVersionAlert,
  parameters: {
    colorScheme: "light",
  },
};

export const Default: StoryObj = {};

export const Desktop: StoryObj = {
  args: {
    isDesktop: true,
  },
};
