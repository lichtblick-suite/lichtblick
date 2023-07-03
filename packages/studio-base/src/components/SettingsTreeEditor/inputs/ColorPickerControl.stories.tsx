// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";
import { useState } from "react";

import { ColorPickerControl } from "./ColorPickerControl";

export default {
  title: "components/ColorPickerControl",
  component: ColorPickerControl,
};

export const Default: StoryObj = {
  render: function Story() {
    const [color, setColor] = useState("#ffaa00");

    return <ColorPickerControl alphaType="none" value={color} onChange={setColor} />;
  },
};

export const WithAlpha: StoryObj = {
  render: function Story() {
    const [color, setColor] = useState("#ffaa0088");

    return <ColorPickerControl alphaType="alpha" value={color} onChange={setColor} />;
  },
};

export const TextEntry: StoryObj = {
  render: function Story() {
    const [color, setColor] = useState("");

    return <ColorPickerControl alphaType="none" value={color} onChange={setColor} />;
  },

  play: async () => {
    const { click, type } = userEvent.setup();
    const inputs = await screen.findAllByPlaceholderText("RRGGBB");
    for (const input of inputs) {
      await click(input);
      await type(input, "aabbcc");
    }
  },
};
