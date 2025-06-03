// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { screen, userEvent } from "@storybook/testing-library";
import { useState } from "react";

import { ColorPickerControl, useColorPickerControl } from "./ColorPickerControl";

export default {
  title: "components/ColorPickerControl",
  component: ColorPickerControl,
};

export const Default: StoryObj = {
  render: function Story() {
    const [color, setColor] = useState("#ffaa00");

    const colorPickerProps = useColorPickerControl({
      alphaType: "none",
      onChange: setColor,
      value: color,
    });

    return <ColorPickerControl {...colorPickerProps} />;
  },
};

export const WithAlpha: StoryObj = {
  render: function Story() {
    const [color, setColor] = useState("#ffaa0088");

    const colorPickerProps = useColorPickerControl({
      alphaType: "alpha",
      onChange: setColor,
      value: color,
    });

    return <ColorPickerControl {...colorPickerProps} />;
  },
};

export const TextEntry: StoryObj = {
  render: function Story() {
    const [color, setColor] = useState("");

    const colorPickerProps = useColorPickerControl({
      alphaType: "none",
      onChange: setColor,
      value: color,
    });

    return <ColorPickerControl {...colorPickerProps} />;
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
