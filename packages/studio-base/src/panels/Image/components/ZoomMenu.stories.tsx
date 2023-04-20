// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import ZoomMenu from "./ZoomMenu";

export default {
  title: "panels/Image/ZoomMenu",
  component: ZoomMenu,
};

export const Dark: StoryObj = {
  render: () => {
    return (
      <div style={{ height: 250, margin: 10, position: "relative" }}>
        <ZoomMenu open zoom={1} setZoom={() => {}} setZoomMode={() => {}} resetPanZoom={() => {}} />
      </div>
    );
  },

  parameters: { colorScheme: "dark" },
};

export const Light: StoryObj = {
  render: () => {
    return (
      <div style={{ height: 250, margin: 10, position: "relative" }}>
        <ZoomMenu open zoom={1} setZoom={() => {}} setZoomMode={() => {}} resetPanZoom={() => {}} />
      </div>
    );
  },

  parameters: { colorScheme: "light" },
};
