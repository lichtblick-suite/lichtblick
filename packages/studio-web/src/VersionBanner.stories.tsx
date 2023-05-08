// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import VersionBanner from "./VersionBanner";

export default {
  title: "web/VersionBanner",
  component: VersionBanner,
};

export const OldChrome: StoryObj = {
  render: () => {
    return <VersionBanner isChrome currentVersion={42} isDismissable />;
  },
};

export const UnsupportedBrowser: StoryObj = {
  render: () => {
    return <VersionBanner isChrome={false} currentVersion={42} isDismissable />;
  },
};

export const Undismissable: StoryObj = {
  render: () => {
    return (
      <div style={{ height: "100vh" }}>
        <VersionBanner isChrome={false} currentVersion={42} isDismissable={false} />
      </div>
    );
  },
};
