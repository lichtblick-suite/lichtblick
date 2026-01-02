// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryContext, StoryObj } from "@storybook/react";
import { action } from "storybook/actions";

import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";

import TeleopPanel from "./index";

export default {
  title: "panels/Teleop",
  component: TeleopPanel,
  decorators: [
    (StoryComponent: StoryFn, context: StoryContext): React.JSX.Element => {
      return (
        <PanelSetup
          fixture={{ capabilities: [PLAYER_CAPABILITIES.advertise], publish: action("publish") }}
          includeSettings={context.parameters.includeSettings}
        >
          <StoryComponent />
        </PanelSetup>
      );
    },
  ],
};

export const Unconfigured: StoryObj = {
  render: () => {
    return <TeleopPanel />;
  },
};

export const WithSettings: StoryObj = {
  render: function Story() {
    return <TeleopPanel overrideConfig={{ topic: "/abc" }} />;
  },

  parameters: {
    colorScheme: "light",
    includeSettings: true,
  },
};

export const WithTopic: StoryObj = {
  render: () => {
    return <TeleopPanel overrideConfig={{ topic: "/abc" }} />;
  },
};
