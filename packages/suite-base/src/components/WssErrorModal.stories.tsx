// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import WssErrorModal from "./WssErrorModal";

export default {
  title: "components/WssErrorModal",
  component: WssErrorModal,
  parameters: {
    colorScheme: "light",
  },
};

export const Default: StoryObj = {
  render: () => {
    return (
      <WssErrorModal
        playerProblems={[{ severity: "error", message: "Insecure WebSocket connection" }]}
      />
    );
  },
};
